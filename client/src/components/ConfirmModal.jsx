import React from "react";

export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger", // 'danger' | 'warning' | 'primary'
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#12141c] border-2 border-white/20 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-[8px_8px_0px_0px_#ef4444] space-y-6 text-center">
        {/* Icon */}
        <div
          className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border-2 ${
            type === "danger"
              ? "bg-red-950/80 border-red-500 text-red-400 shadow-[3px_3px_0px_0px_#ef4444]"
              : type === "warning"
              ? "bg-amber-950/80 border-amber-500 text-amber-400 shadow-[3px_3px_0px_0px_#f59e0b]"
              : "bg-blue-950/80 border-blue-500 text-blue-400 shadow-[3px_3px_0px_0px_#3b82f6]"
          }`}
        >
          {type === "danger" ? (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ) : type === "warning" ? (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed font-medium">
            {message}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-[#1e2235] hover:bg-[#282d47] text-gray-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider border-2 border-white/20 shadow-[2px_2px_0px_0px_#000] transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer ${
              type === "danger"
                ? "bg-red-600 hover:bg-red-500 text-white shadow-[3px_3px_0px_0px_#facc15]"
                : type === "warning"
                ? "bg-yellow-400 hover:bg-yellow-300 text-black shadow-[3px_3px_0px_0px_#000]"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-[3px_3px_0px_0px_#000]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
