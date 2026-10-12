import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./basics.jsx";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one dialog. It is announced as a dialog, keeps the keyboard inside it, closes on Esc
 * and on a click outside, and hands focus back to whatever opened it.
 *
 * Focus starts on the element marked `data-autofocus`, or on the first control. A destructive
 * button is never where focus starts, so Enter pressed by habit does nothing irreversible.
 */
export default function Dialog({ open, title, onClose, children, footer, width = "max-w-md", busy = false }) {
  const panel = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const node = panel.current;
    const first = node?.querySelector("[data-autofocus]") || node?.querySelector(FOCUSABLE) || node;
    first?.focus();

    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return event.preventDefault();
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === node)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
    // Re-running on every render would steal focus while typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${width} max-h-[92vh] flex flex-col bg-surface-card border-2 border-edge rounded-t-xl sm:rounded-xl sm:shadow-hard-lg focus:outline-none`}
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b-2 border-edge">
          <h2 id={titleId} className="font-display text-lg font-bold text-ink">
            {title}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} className="h-8 w-8 -mr-2 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5" aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="px-5 py-4 overflow-y-auto text-sm text-ink">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t-2 border-edge">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

/**
 * Asks before something that cannot be taken back. Focus starts on Cancel.
 * `tone` is "danger" for what destroys or stops something, "primary" otherwise.
 */
export function ConfirmDialog({ open, title, children, confirmText = "Confirm", cancelText = "Cancel", tone = "primary", busy = false, onConfirm, onCancel }) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy} data-autofocus>
            {cancelText}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} busy={busy}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-ink-muted leading-relaxed">{children}</div>
    </Dialog>
  );
}
