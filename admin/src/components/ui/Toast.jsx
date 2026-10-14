import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

const OK_MS = 6000;

/**
 * Short messages about what just happened, in a corner so they do not move the page.
 * Each is announced to screen readers. A success goes away by itself; an error stays
 * until it is dismissed, since it may need to be read twice.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const show = useCallback(
    (kind, text) => {
      if (!text) return;
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, text }]);
      if (kind === "ok") setTimeout(() => dismiss(id), OK_MS);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ ok: (text) => show("ok", text), error: (text) => show("error", text) }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto sm:w-96 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-soft-lg backdrop-blur ${
              toast.kind === "error" ? "bg-[#2a1216] border-red-500/50 text-red-100" : "bg-surface-raised border-emerald-400/40 text-ink"
            }`}
          >
            <span aria-hidden="true" className={`font-bold ${toast.kind === "error" ? "text-red-300" : "text-emerald-300"}`}>
              {toast.kind === "error" ? "!" : "✓"}
            </span>
            <span className="flex-1 min-w-0 break-words">{toast.text}</span>
            <button type="button" onClick={() => dismiss(toast.id)} className="-mr-1 h-6 w-6 rounded text-ink-muted hover:text-ink hover:bg-white/10" aria-label="Dismiss">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
