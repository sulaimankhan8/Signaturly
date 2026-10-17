import React from "react";
import FieldPalette from "./FieldPalette";
import { PALETTE, labelOf, isRequired, sortForReading } from "./fieldTypes";
import { FieldIcon } from "./icons";

export default function EditorSidebar({
  sidebarTop,
  mode,
  assignable,
  fields,
  ownerKey,
  activeId,
  setActiveId,
  armedType,
  paletteColor,
  activeParticipant,
  onPalettePointerDown,
  placeAtCentre,
  selectedIds,
  setSelectedIds,
  canvasRef,
  setDrawerOpen,
  colorOf,
}) {
  return (
    <div className="p-4 space-y-5">
      {sidebarTop}

      {mode !== "self" && (
        <section aria-labelledby="who-heading" className="space-y-2">
          <h2 id="who-heading" className="text-[11px] font-black uppercase tracking-wider text-gray-300">
            {mode === "template" ? "Fields for role" : "Fields for"}
          </h2>
          {assignable.length === 0 && <p className="text-xs text-red-300">Add a signer first.</p>}
          <div className="space-y-1.5" role="radiogroup" aria-label="Who the next field is for">
            {assignable.map((p) => {
              const theirs = fields.filter((f) => f[ownerKey] === p.id);
              const lacksSignature =
                mode === "send" && p.role === "signer" && !theirs.some((f) => f.type === "signature");
              const active = p.id === activeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setActiveId(p.id)}
                  className={`w-full min-h-[48px] flex items-center gap-2.5 px-2.5 py-2 rounded-xl border-2 text-left transition-all ${
                    active
                      ? "bg-[#1e2235] border-white shadow-[3px_3px_0px_0px_#000]"
                      : "bg-[#090a0f] border-white/10 hover:border-white/30"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 border-black shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-black text-white truncate">{p.name || "Unnamed"}</span>
                    <span
                      className={`block text-[11px] truncate ${
                        lacksSignature ? "text-amber-300 font-bold" : "text-gray-400"
                      }`}
                    >
                      {lacksSignature ? "No signature field yet" : `${theirs.length} field${theirs.length === 1 ? "" : "s"}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="palette-heading" className="space-y-2">
        <h2 id="palette-heading" className="text-[11px] font-black uppercase tracking-wider text-gray-300">
          Add a field
        </h2>
        <FieldPalette
          types={PALETTE[mode]}
          armedType={armedType}
          color={paletteColor}
          disabled={mode !== "self" && !activeParticipant}
          onPointerDown={onPalettePointerDown}
          onKeyboardPlace={placeAtCentre}
        />
        <p className="text-[11px] text-gray-400">
          {armedType ? (
            <>
              Click on the page to place it. <kbd className="font-mono">Esc</kbd> cancels.
            </>
          ) : (
            "Drag onto the page, or click then click where it goes."
          )}
        </p>
      </section>

      <section aria-labelledby="list-heading" className="space-y-2">
        <h2 id="list-heading" className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex justify-between">
          <span>On this document</span>
          <span className="text-yellow-400 tabular-nums">{fields.length}</span>
        </h2>
        {fields.length === 0 ? (
          <p className="text-xs text-gray-500">No fields yet.</p>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {sortForReading(fields).map((field) => (
              <li key={field.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds([field.id]);
                    canvasRef.current?.scrollToField(field.id);
                    setDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] border-2 ${
                    selectedIds.includes(field.id)
                      ? "border-yellow-400 bg-[#1e2235]"
                      : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(field) }} />
                  <FieldIcon type={field.type} className="w-3.5 h-3.5 shrink-0 text-gray-300" />
                  <span className="truncate flex-1 text-gray-200 font-bold">
                    {labelOf(field)}
                    {mode !== "self" && isRequired(field) ? " *" : ""}
                  </span>
                  <span className="text-gray-500 shrink-0">p.{field.page}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="text-[11px] text-gray-400">
        <summary className="cursor-pointer font-black uppercase tracking-wider text-gray-300">
          Keyboard shortcuts
        </summary>
        <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
          {[
            ["Tab", "Go to the next field"],
            ["Arrows", "Nudge (Shift: more)"],
            ["Delete", "Delete"],
            ["Ctrl+Z", "Undo"],
            ["Ctrl+Shift+Z", "Redo"],
            ["Ctrl+C / V", "Copy / paste"],
            ["Ctrl+D", "Duplicate"],
            ["Ctrl+A", "Pick all on the page"],
            ["Shift+click", "Pick several"],
            ["Alt+drag", "Move without snapping"],
            ["Esc", "Let go"],
          ].map(([keys, words]) => (
            <div key={keys} className="contents">
              <dt className="font-mono text-gray-200">{keys}</dt>
              <dd>{words}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
