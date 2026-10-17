import React from "react";
import { UI } from "./icons";
import { saveStatusText } from "./useAutosave";

const iconButton =
  "w-10 h-10 shrink-0 rounded-xl border-2 border-white/15 bg-[#1e2235] hover:bg-[#282d47] text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none";

export default function EditorHeader({
  title,
  subtitle,
  saveStatus,
  steps,
  undo,
  redo,
  canUndo,
  canRedo,
  zoomLabel,
  stepZoom,
  setZoom,
  thumbnails,
  setThumbnails,
  primaryAction,
  secondaryAction,
  onBack,
  backLabel = "Back",
  notice,
}) {
  return (
    <header className="shrink-0 border-b-2 border-white/15 bg-[#0d0f16]">
      <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onBack}
          className={`${iconButton} sm:w-auto sm:px-3 gap-1.5`}
          aria-label={backLabel}
        >
          <UI.back className="w-4 h-4" />
          <span className="hidden sm:inline text-[11px] font-black uppercase tracking-wider">
            {backLabel}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black text-white truncate" title={title}>
            {title}
          </h1>
          <p className="text-[11px] text-gray-400 truncate flex items-center gap-2">
            {subtitle && <span className="truncate">{subtitle}</span>}
            {saveStatus && (
              <span
                role="status"
                className={`shrink-0 font-bold ${
                  saveStatus === "error" ? "text-amber-300" : "text-gray-500"
                }`}
              >
                {saveStatusText(saveStatus)}
              </span>
            )}
          </p>
        </div>

        {steps && (
          <ol
            className="hidden xl:flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
            aria-label="Steps"
          >
            {steps.map((step, index) => (
              <li key={step.label} className="flex items-center gap-1">
                {index > 0 && <span className="w-4 h-0.5 bg-white/20" aria-hidden="true" />}
                <button
                  type="button"
                  disabled={!step.onClick}
                  onClick={step.onClick}
                  aria-current={step.active ? "step" : undefined}
                  className={`px-2.5 py-1.5 rounded-lg border-2 ${
                    step.active
                      ? "bg-yellow-400 text-black border-black"
                      : step.done
                      ? "border-white/20 text-white hover:bg-white/10"
                      : "border-white/10 text-gray-500"
                  }`}
                >
                  {index + 1}. {step.label}
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="hidden md:flex items-center gap-1.5">
          <button
            type="button"
            className={iconButton}
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <UI.undo />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            <UI.redo />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-1 rounded-xl border-2 border-white/15 bg-[#1e2235] px-1">
          <button
            type="button"
            className="w-8 h-9 flex items-center justify-center hover:text-yellow-400"
            onClick={() => stepZoom(-1)}
            aria-label="Zoom out"
          >
            <UI.zoomOut />
          </button>
          <button
            type="button"
            className="min-w-[52px] h-9 text-[11px] font-black tabular-nums hover:text-yellow-400"
            onClick={() => setZoom("fit")}
            aria-label={`Zoom ${zoomLabel}. Fit to width`}
            title="Fit to width"
          >
            {zoomLabel}
          </button>
          <button
            type="button"
            className="w-8 h-9 flex items-center justify-center hover:text-yellow-400"
            onClick={() => stepZoom(1)}
            aria-label="Zoom in"
          >
            <UI.zoomIn />
          </button>
        </div>

        <button
          type="button"
          className={`${iconButton} hidden md:flex ${thumbnails ? "border-yellow-400" : ""}`}
          onClick={() => setThumbnails((on) => !on)}
          aria-pressed={thumbnails}
          aria-label="Page thumbnails"
          title="Page thumbnails"
        >
          <UI.pages />
        </button>

        {secondaryAction}

        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.busy}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 sm:px-5 rounded-xl border-2 border-black bg-red-600 hover:bg-red-500 text-white text-[11px] font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#facc15] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
          >
            {primaryAction.busy ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              primaryAction.icon
            )}
            <span>
              {primaryAction.busy
                ? primaryAction.busyLabel || primaryAction.label
                : primaryAction.label}
            </span>
          </button>
        )}
      </div>
      {notice}
    </header>
  );
}
