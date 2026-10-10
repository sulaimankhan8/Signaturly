import { Document, Page, pdfjs } from "react-pdf";
import { useMemo, useRef } from "react";

// Served with the app itself, so reading a document does not depend on a third-party network
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.js", import.meta.url).toString();

const Spinner = () => (
  <div className="flex items-center justify-center p-16">
    <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
  </div>
);

/**
 * Shows one page of a PDF. Only the page on screen is drawn, and the file is fetched in pieces
 * where the server allows it, so a long document opens quickly on a slow connection.
 *
 * @param {number} [width] - draw the page this many pixels wide (used to fit a phone screen);
 *                           without it the page is drawn at its natural size
 */
export default function PdfViewer({ fileUrl, pageNumber, onPageRender, width }) {
  const containerRef = useRef(null);
  const file = useMemo(
    () => ({
      url: encodeURI(fileUrl),
      withCredentials: false,
    }),
    [fileUrl]
  );

  const handleRenderSuccess = () => {
    if (containerRef.current) {
      const canvas = containerRef.current.querySelector("canvas");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        onPageRender({
          width: rect.width || canvas.offsetWidth,
          height: rect.height || canvas.offsetHeight,
        });
      }
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block pdf-page shadow-2xl rounded-lg overflow-hidden border border-gray-700 bg-white">
      <Document file={file} loading={<Spinner />}>
        <Page
          pageNumber={pageNumber}
          width={width || undefined}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={handleRenderSuccess}
          loading={<Spinner />}
        />
      </Document>
    </div>
  );
}
