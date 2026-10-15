import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import SignatureManager from "../SignatureManager";
import { LIGHT } from "./lightTheme";

/**
 * The dialog for making a signature, initials or company stamp. A sheet from the bottom on a
 * phone, a centred box elsewhere. Escape closes it, and the keyboard stays inside while it is open.
 */
export default function SignatureStudio({ open, onClose, kinds, kind, current, onAdopt, signerName, footer = null, title }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const returnFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocus.current = document.activeElement;
    const dialog = dialogRef.current;
    requestAnimationFrame(() => dialog?.querySelector("button, input, [tabindex]")?.focus());

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-studio-title"
        className="bg-white text-gray-900 border-2 border-black rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain shadow-[6px_6px_0px_0px_#000] p-4 sm:p-6 space-y-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="signature-studio-title" className="text-base font-black uppercase tracking-tight">
            {title || t("sidebar.studioTitle")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("actions.close")} className={`${LIGHT.quiet} w-11 h-11 -mr-2`}>
            ✕
          </button>
        </div>
        <SignatureManager kinds={kinds} kind={kind} current={current} onAdopt={onAdopt} signerName={signerName} />
        {footer}
      </div>
    </div>
  );
}
