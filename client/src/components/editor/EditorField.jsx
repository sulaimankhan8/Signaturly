import { memo, useEffect, useRef, useState } from "react";
import { isRequired, labelOf, typeOf } from "./fieldTypes";
import { FieldIcon } from "./icons";

const HANDLES = [
  { id: "nw", className: "-left-[7px] -top-[7px] cursor-nwse-resize" },
  { id: "ne", className: "-right-[7px] -top-[7px] cursor-nesw-resize" },
  { id: "sw", className: "-left-[7px] -bottom-[7px] cursor-nesw-resize" },
  { id: "se", className: "-right-[7px] -bottom-[7px] cursor-nwse-resize" },
];

/**
 * A field on the page as the sender sees it while preparing a document: it can be moved,
 * resized, selected and reached with the keyboard. Moving and resizing are done by the editor
 * (DocumentEditor), which this reports pointer presses to.
 *
 * In the "self" editor the sender is also the signer, so text, dates and ticks are filled in
 * right here and image fields show the sender's own signature.
 */
function EditorField({
  field,
  pageWidth,
  pageHeight,
  mode,
  color,
  ownerName,
  selected,
  primary,
  inGroup,
  image,
  autoValues,
  onPointerDown,
  onFocusField,
  onActivate,
  onChangeValue,
  onDuplicate,
  onRemove,
  dragged,
}) {
  const [editingText, setEditing] = useState(false);
  // Typing ends when the field is let go of
  const editing = editingText && selected;
  const inputRef = useRef(null);
  const config = typeOf(field);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const left = field.xPercent * pageWidth;
  const top = field.yPercent * pageHeight;
  const width = Math.max(12, field.widthPercent * pageWidth);
  const height = Math.max(12, field.heightPercent * pageHeight);
  const fontSize = field.fontSizePercent ? field.fontSizePercent * pageHeight : height * 0.55;
  const self = mode === "self";
  const required = !self && isRequired(field);

  const describe = `${labelOf(field)}${ownerName && !self ? ` for ${ownerName}` : ""}, page ${field.page}${required ? ", required" : ""}`;

  const startEditingText = () => {
    if (self && field.type === "text") setEditing(true);
  };

  const content = () => {
    if (config.image) {
      if (image) return <img src={image} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none select-none" />;
      return (
        <span className="flex items-center gap-1.5 px-1 font-black uppercase tracking-wider truncate" style={{ fontSize: Math.min(12, Math.max(8, height * 0.28)), color }}>
          <FieldIcon type={field.type} className="w-4 h-4 shrink-0" />
          <span className="truncate">{self ? `Add ${labelOf(field).toLowerCase()}` : labelOf(field)}</span>
        </span>
      );
    }

    if (field.type === "checkbox") {
      const ticked = self && field.checked;
      return (
        <span
          className="block w-full h-full border-2 rounded-[3px] flex items-center justify-center"
          style={{ borderColor: color, background: ticked ? color : "#fff" }}
        >
          {ticked && (
            <svg viewBox="0 0 24 24" className="w-3/4 h-3/4 text-white" fill="none" stroke="currentColor" strokeWidth={4} aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      );
    }

    if (field.type === "radio") {
      return <span className="block w-full h-full rounded-full border-2 bg-white" style={{ borderColor: color }} />;
    }

    if (editing) {
      return (
        <input
          ref={inputRef}
          value={field.value || ""}
          onChange={(event) => onChangeValue(field, { value: event.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={labelOf(field)}
          className="w-full h-full px-1.5 bg-white text-gray-900 outline-none"
          style={{ fontSize }}
        />
      );
    }

    let words = "";
    let filled = false;
    if (self && (field.type === "name" || field.type === "email")) {
      words = autoValues?.[field.type] || labelOf(field);
      filled = Boolean(autoValues?.[field.type]);
    } else if (self && field.type === "date") {
      words = field.value || "Date";
      filled = Boolean(field.value);
    } else if (field.type === "text" && field.value) {
      words = field.value;
      filled = true;
    } else if (field.type === "text") {
      words = field.placeholder || labelOf(field);
    } else if (field.type === "dropdown") {
      words = field.value || field.label || field.options?.[0] || "Choose";
    } else {
      words = labelOf(field);
    }

    return (
      <span className="flex items-center w-full h-full px-1.5 gap-1 overflow-hidden">
        <span
          className={`truncate leading-none ${filled ? "text-gray-900 font-medium" : "font-bold"}`}
          style={{ fontSize, color: filled ? undefined : color }}
        >
          {words}
        </span>
        {field.type === "dropdown" && (
          <svg viewBox="0 0 24 24" className="w-3 h-3 ml-auto shrink-0" fill="none" stroke={color} strokeWidth={3} aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div
      id={`field-${field.id}`}
      data-field={field.id}
      data-testid={`field-${field.type}`}
      role="button"
      tabIndex={0}
      aria-label={describe}
      aria-pressed={selected}
      title={describe}
      className={`absolute select-none touch-none outline-none group ${editing ? "cursor-text" : "cursor-move"}`}
      style={{ left, top, width, height, zIndex: selected ? 20 : 10 }}
      onPointerDown={(event) => {
        if (editing) return;
        onPointerDown(event, field, "move");
      }}
      onFocus={() => onFocusField(field)}
      onDoubleClick={startEditingText}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (self && field.type === "text") setEditing(true);
          else onActivate(field);
        }
      }}
      onClick={(event) => {
        // In the self editor a click on the field already picked fills it in; the first click
        // only picks it, and the click that ends a drag does neither
        if (event.detail === 0 || !self) return;
        if (dragged?.current?.moved || !dragged?.current?.wasPicked) return;
        if (selected) {
          if (field.type === "text") setEditing(true);
          else onActivate(field);
        }
      }}
    >
      <div
        className={`w-full h-full flex items-center justify-center overflow-hidden transition-shadow ${
          config.square ? "" : "rounded-[3px] border-2"
        } ${selected ? "" : "group-hover:brightness-95"} ${inGroup && !selected ? "outline outline-2 outline-dashed outline-offset-2" : ""}`}
        style={{
          borderColor: color,
          outlineColor: color,
          background: config.square ? "transparent" : image ? "rgba(255,255,255,0.35)" : `${color}26`,
          boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : "none",
        }}
      >
        {content()}
      </div>

      {required && (
        <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-600 border border-black text-white text-[9px] leading-[12px] font-black text-center">
          *
        </span>
      )}

      {primary && (
        <>
          <div
            className={`absolute left-0 ${top < 40 ? "top-full mt-2" : "-top-9"} flex items-center gap-1 whitespace-nowrap rounded-lg border-2 border-black bg-[#13151f] px-1.5 py-1 text-[11px] font-black text-white shadow-[2px_2px_0px_0px_#000] z-30`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="px-1 max-w-[180px] truncate">
              {ownerName && !self ? `${ownerName} · ` : ""}
              {labelOf(field)}
            </span>
            <button
              type="button"
              onClick={() => onDuplicate(field)}
              className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center"
              aria-label="Duplicate field"
              title="Duplicate (Ctrl+D)"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onRemove(field)}
              className="w-6 h-6 rounded hover:bg-red-600 flex items-center justify-center text-red-300 hover:text-white"
              aria-label="Delete field"
              title="Delete (Del)"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
              </svg>
            </button>
          </div>

          {HANDLES.map((handle) => (
            <span
              key={handle.id}
              aria-hidden="true"
              className={`absolute w-3.5 h-3.5 bg-white border-2 border-black rounded-[3px] z-30 ${handle.className}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                onPointerDown(event, field, handle.id);
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default memo(EditorField);
