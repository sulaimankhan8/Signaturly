import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useTranslation } from "react-i18next";

// Served with the app itself, so reading a document does not depend on a third-party network
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.js", import.meta.url).toString();

// Pages this far outside the screen are drawn ahead; further ones are blank boxes of the right size.
// Only a few canvases exist at a time, so a 200-page contract opens on a phone with little memory,
// and over a slow connection only the pages near the screen are fetched.
const DRAW_AHEAD = "800px 0px";
const PAGE_GAP = 24;
const SIDE_PADDING = 24;
const THUMB_WIDTH = 92;

/**
 * Every page of a PDF, one under another, with an overlay on each page for fields.
 *
 * Pages are drawn as a reader sees them (crop box and rotation applied, as on the server), and
 * field positions are shares of that drawn page, so they land in the same place in the file.
 *
 * zoom        "fit" (as wide as there is room for, up to maxFitWidth) or a scale, 1 = 100%
 * scrollMode  "self": the canvas has its own scroll bar (the editors);
 *             "page": it grows to its full height and the browser window scrolls (signing)
 *
 * The handle (ref) offers scrollToPage(n), scrollToField(id), pagePoint(clientX, clientY) and
 * visibleCentre().
 */
const DocumentCanvas = forwardRef(function DocumentCanvas(
  {
    fileUrl,
    zoom = "fit",
    maxFitWidth = 1000,
    scrollMode = "self",
    showThumbnails = false,
    thumbnailBadge = null,
    renderOverlay,
    onLoad,
    onScaleChange,
    onCurrentPageChange,
    onPagePointerDown,
    pageClassName = "",
    className = "",
    children,
  },
  ref
) {
  // Signers read this in their own language; the editors are in English
  const { t } = useTranslation();
  const [pages, setPages] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [width, setWidth] = useState(0);
  const [near, setNear] = useState(() => new Set([1]));
  const [currentPage, setCurrentPage] = useState(1);

  const scrollerRef = useRef(null);
  const [scrollerElement, setScrollerElement] = useState(null);
  const attachScroller = useCallback((element) => {
    scrollerRef.current = element;
    setScrollerElement(element);
  }, []);
  const pageRefs = useRef(new Map());
  const ratios = useRef(new Map());

  const file = useMemo(() => ({ url: encodeURI(fileUrl), withCredentials: false }), [fileUrl]);

  // ---- size ----

  useEffect(() => {
    const element = scrollerElement;
    if (!element) return undefined;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollerElement]);

  const widestPage = pages ? Math.max(...pages.map((p) => p.width)) : 612;
  const padding = width < 480 ? 8 : SIDE_PADDING;
  const scale =
    zoom === "fit" ? Math.max(0.2, Math.min(width - padding * 2, maxFitWidth) / widestPage) : Math.max(0.2, Number(zoom) || 1);

  useEffect(() => {
    if (width > 0) onScaleChange?.(scale);
  }, [scale, width, onScaleChange]);

  // ---- loading ----

  // Only the first page is measured before drawing; the others are taken to be the same size
  // until each is drawn and measured itself. Reading every page first would fetch most of a
  // long file before anything appears.
  const handleLoad = useCallback(
    async (pdf) => {
      try {
        const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
        const sizes = Array.from({ length: pdf.numPages }, () => ({ width: first.width, height: first.height }));
        setPages(sizes);
        onLoad?.({ pages: sizes });
      } catch (err) {
        setLoadError(err);
      }
    },
    [onLoad]
  );

  // A page drawn at a size other than the first page's takes its own size
  const measurePage = useCallback(
    (index, page) => {
      const viewport = page.getViewport({ scale: 1 });
      setPages((current) => {
        const known = current?.[index];
        if (!known || (Math.abs(known.width - viewport.width) < 0.5 && Math.abs(known.height - viewport.height) < 0.5)) return current;
        const next = [...current];
        next[index] = { width: viewport.width, height: viewport.height };
        return next;
      });
    },
    []
  );

  // Tell the editor when a page turns out to be a different size
  const reported = useRef(null);
  useEffect(() => {
    if (pages && reported.current && reported.current !== pages) onLoad?.({ pages });
    reported.current = pages;
  }, [pages, onLoad]);

  // ---- which pages are near the screen, and which one is being read ----

  // The pages exist on screen once the document has loaded and there is room to draw them
  const drawn = Boolean(pages) && width > 0;

  // A browser without IntersectionObserver draws every page
  const canObserve = typeof IntersectionObserver !== "undefined";
  const isNear = (page) => !canObserve || near.has(page);

  useEffect(() => {
    if (!drawn || !canObserve) return undefined;
    const root = scrollMode === "self" ? scrollerRef.current : null;

    const nearObserver = new IntersectionObserver(
      (entries) => {
        setNear((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const page = Number(entry.target.dataset.documentPage);
            if (entry.isIntersecting) next.add(page);
            else next.delete(page);
          }
          return next;
        });
      },
      { root, rootMargin: DRAW_AHEAD }
    );

    const readingObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.current.set(Number(entry.target.dataset.documentPage), entry.intersectionRatio);
        let best = 1;
        let bestRatio = -1;
        for (const [page, ratio] of ratios.current) {
          if (ratio > bestRatio + 0.001 || (Math.abs(ratio - bestRatio) <= 0.001 && page < best)) {
            best = page;
            bestRatio = ratio;
          }
        }
        setCurrentPage(best);
      },
      { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );

    for (const element of pageRefs.current.values()) {
      nearObserver.observe(element);
      readingObserver.observe(element);
    }
    return () => {
      nearObserver.disconnect();
      readingObserver.disconnect();
    };
  }, [drawn, canObserve, pages, scrollMode, scale]);

  useEffect(() => {
    onCurrentPageChange?.(currentPage);
  }, [currentPage, onCurrentPageChange]);

  // ---- the handle ----

  const pagePoint = useCallback((clientX, clientY) => {
    for (const [page, element] of pageRefs.current) {
      const rect = element.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return {
          page,
          xPercent: (clientX - rect.left) / rect.width,
          yPercent: (clientY - rect.top) / rect.height,
          rect,
        };
      }
    }
    return null;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToPage(page, behavior = "smooth") {
        pageRefs.current.get(page)?.scrollIntoView({ behavior, block: "start" });
      },
      scrollToField(fieldId, behavior = "smooth") {
        const element = document.getElementById(`field-${fieldId}`);
        if (element) element.scrollIntoView({ behavior, block: "center", inline: "nearest" });
        return element;
      },
      pagePoint,
      pageRect(page) {
        return pageRefs.current.get(page)?.getBoundingClientRect() || null;
      },
      // The middle of what is on screen of the page being read, for placing a field from the keyboard
      visibleCentre() {
        const element = pageRefs.current.get(currentPage);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const view = scrollMode === "self" && scrollerRef.current ? scrollerRef.current.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        const top = Math.max(rect.top, view.top);
        const bottom = Math.min(rect.bottom, view.bottom);
        const middle = bottom > top ? (top + bottom) / 2 : rect.top + rect.height / 2;
        return { page: currentPage, xPercent: 0.5, yPercent: Math.min(0.95, Math.max(0.05, (middle - rect.top) / rect.height)) };
      },
      currentPage,
      scale,
    }),
    [currentPage, pagePoint, scale, scrollMode]
  );

  const setPageRef = (page) => (element) => {
    if (element) pageRefs.current.set(page, element);
    else pageRefs.current.delete(page);
  };

  // ---- drawing ----

  const loading = (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <div className="w-9 h-9 border-4 border-black/10 border-t-red-600 rounded-full animate-spin" />
      <span className="sr-only">{t("canvas.loading")}</span>
    </div>
  );

  const scroller =
    scrollMode === "self" ? "flex-1 min-w-0 overflow-auto overscroll-contain" : "w-full min-w-0";

  return (
    <Document
      file={file}
      onLoadSuccess={handleLoad}
      onLoadError={setLoadError}
      loading={loading}
      error={<p className="p-8 text-center text-sm font-bold text-red-500">{t("canvas.loadFailed")}</p>}
      className={`flex ${scrollMode === "self" ? "h-full min-h-0" : ""} ${className}`}
    >
      {showThumbnails && pages && (
        <Thumbnails
          pages={pages}
          currentPage={currentPage}
          badge={thumbnailBadge}
          onPick={(page) => pageRefs.current.get(page)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      )}

      <div ref={attachScroller} className={`${scroller} relative`} data-document-scroller="">
        {loadError && <p className="p-8 text-center text-sm font-bold text-red-500">{t("canvas.loadFailed")}</p>}

        {drawn && (
          <div className="flex flex-col items-center" style={{ gap: PAGE_GAP, padding: `${padding}px ${padding}px ${padding * 2}px` }}>
            {pages.map((natural, index) => {
              const page = index + 1;
              const size = { width: natural.width * scale, height: natural.height * scale };
              return (
                <div
                  key={page}
                  ref={setPageRef(page)}
                  data-document-page={page}
                  className={`relative shrink-0 bg-white ${pageClassName}`}
                  style={{ width: size.width, height: size.height }}
                  onPointerDown={onPagePointerDown ? (event) => onPagePointerDown(event, pagePoint(event.clientX, event.clientY)) : undefined}
                  aria-label={t("canvas.pageOf", { page, total: pages.length })}
                  role="region"
                >
                  {isNear(page) ? (
                    <Page
                      pageNumber={page}
                      width={size.width}
                      onLoadSuccess={(proxy) => measurePage(index, proxy)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      loading={<div style={{ width: size.width, height: size.height }} />}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-black uppercase tracking-wider text-gray-300 select-none">
                      {t("canvas.page", { page })}
                    </div>
                  )}

                  <div className="absolute inset-0" data-page-overlay={page}>
                    {renderOverlay?.(page, { width: size.width, height: size.height, scale, natural })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {children}
      </div>
    </Document>
  );
});

export default DocumentCanvas;

/** Small pictures of every page down the left; the page being read is marked */
function Thumbnails({ pages, currentPage, badge, onPick }) {
  const { t } = useTranslation();
  const railRef = useRef(null);
  const [visible, setVisible] = useState(() => new Set([1, 2, 3, 4, 5, 6]));
  const itemRefs = useRef(new Map());

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const page = Number(entry.target.dataset.thumb);
            if (entry.isIntersecting) next.add(page);
            else next.delete(page);
          }
          return next;
        });
      },
      { root: railRef.current, rootMargin: "400px 0px" }
    );
    for (const element of itemRefs.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [pages]);

  // Keep the marked page in view in the rail
  useEffect(() => {
    itemRefs.current.get(currentPage)?.scrollIntoView({ block: "nearest" });
  }, [currentPage]);

  return (
    <nav
      ref={railRef}
      aria-label={t("canvas.pages")}
      className="hidden md:flex flex-col gap-3 w-[124px] shrink-0 overflow-y-auto overscroll-contain border-r-2 border-white/10 bg-[#0d0f16] p-3"
    >
      {pages.map((natural, index) => {
        const page = index + 1;
        const height = (natural.height / natural.width) * THUMB_WIDTH;
        const count = badge?.(page);
        const active = page === currentPage;
        return (
          <button
            key={page}
            type="button"
            data-thumb={page}
            ref={(element) => (element ? itemRefs.current.set(page, element) : itemRefs.current.delete(page))}
            onClick={() => onPick(page)}
            aria-label={count ? t("canvas.goToPageFields", { page, count }) : t("canvas.goToPage", { page })}
            aria-current={active ? "page" : undefined}
            className={`relative mx-auto block bg-white rounded-sm border-2 transition-all ${
              active ? "border-yellow-400 shadow-[3px_3px_0px_0px_#facc15]" : "border-black/60 hover:border-white/70"
            }`}
            style={{ width: THUMB_WIDTH + 4, height: height + 4 }}
          >
            {visible.has(page) && (
              <Page pageNumber={page} width={THUMB_WIDTH} renderTextLayer={false} renderAnnotationLayer={false} loading={null} />
            )}
            <span className="absolute bottom-1 left-1 px-1 rounded bg-black text-white text-[9px] font-black">{page}</span>
            {count > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-red-600 border-2 border-black text-white text-[10px] font-black flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
