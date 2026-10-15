import { FIELD_TYPES } from "./fieldTypes";
import { FieldIcon } from "./icons";

/**
 * The fields that can be put on the document. Drag one onto a page, or click it and then click
 * where it goes (on a phone, tap and tap). From the keyboard, Enter puts it in the middle of the
 * page on screen.
 */
export default function FieldPalette({ types, armedType, color = "#facc15", disabled = false, onPointerDown, onKeyboardPlace }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="list" aria-label="Fields you can add">
      {types.map((type) => {
        const config = FIELD_TYPES[type];
        const armed = armedType === type;
        return (
          <div role="listitem" key={type}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={armed}
              title={`${config.label}: ${config.hint}`}
              onPointerDown={(event) => onPointerDown(event, type)}
              onClick={(event) => {
                // A click made with the keyboard has no pointer position
                if (event.detail === 0) onKeyboardPlace(type);
              }}
              className={`w-full min-h-[44px] flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 text-left transition-all select-none touch-manipulation disabled:opacity-40 ${
                armed
                  ? "bg-yellow-400 text-black border-black shadow-[3px_3px_0px_0px_#000]"
                  : "bg-[#1e2235] hover:bg-[#282d47] text-white border-white/15 hover:border-white/40 shadow-[2px_2px_0px_0px_#000] cursor-grab active:cursor-grabbing"
              }`}
            >
              <span
                className="w-7 h-7 shrink-0 rounded-lg border-2 border-black flex items-center justify-center"
                style={{ background: armed ? "#000" : color, color: armed ? "#facc15" : "#000" }}
              >
                <FieldIcon type={type} className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-wide leading-tight truncate">{config.label}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
