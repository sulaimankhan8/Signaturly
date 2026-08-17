import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { useState, useEffect, useRef } from "react";
import "react-resizable/css/styles.css";

export default function DraggableField({
  field,
  pageWidth,
  pageHeight,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  signerColor = null,
  signerName = null,
}) {
  const [localField, setLocalField] = useState(field);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);
  const fieldRef = useRef(null);

  useEffect(() => {
    setLocalField(field);
  }, [field]);

  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e) => {
      if (isEditing) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onRemove(localField.id);
      } else if (e.key === "Escape") {
        onSelect(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelected, isEditing, localField.id, onRemove, onSelect]);

  const xPx = localField.xPercent * pageWidth;
  const yPx = localField.yPercent * pageHeight;
  const w = Math.max(30, localField.widthPercent * pageWidth);
  const h = Math.max(20, localField.heightPercent * pageHeight);

  const fontSizePx = localField.fontSizePercent
    ? localField.fontSizePercent * pageHeight
    : h * 0.55;

  const activeColor = signerColor || localField.recipientColor || "#ef4444";

  const handleUpdate = (updates) => {
    const updated = { ...localField, ...updates };
    setLocalField(updated);
    onUpdate(updated);
  };

  const handleFontSizeChange = (delta) => {
    const nextPx = Math.max(8, Math.min(96, fontSizePx + delta));
    handleUpdate({ fontSizePercent: nextPx / pageHeight });
  };

  const renderToolbar = () => {
    if (!isSelected) return null;

    return (
      <div
        className="absolute -top-10 left-0 flex items-center bg-[#0e1017] text-white rounded-xl shadow-2xl px-2.5 py-1 space-x-2 text-xs border z-50 animate-fade-in"
        style={{ borderColor: activeColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-bold capitalize px-1 text-[11px]" style={{ color: activeColor }}>
          {signerName ? `${signerName}: ` : ""}{localField.type}
        </span>

        {localField.type !== "signature" && localField.type !== "initials" && (
          <div className="flex items-center space-x-1 border-l border-r border-white/10 px-2">
            <span className="text-gray-400 text-[10px] uppercase font-mono">Font:</span>
            <button
              type="button"
              className="w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center text-gray-200 font-bold text-xs"
              onClick={() => handleFontSizeChange(-1)}
              title="Decrease font size"
            >
              −
            </button>
            <span className="text-[11px] font-mono w-5 text-center font-bold" style={{ color: activeColor }}>
              {Math.round(fontSizePx)}
            </span>
            <button
              type="button"
              className="w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center text-gray-200 font-bold text-xs"
              onClick={() => handleFontSizeChange(1)}
              title="Increase font size"
            >
              +
            </button>
          </div>
        )}

        <button
          type="button"
          className="text-red-400 hover:text-white hover:bg-red-600/30 p-1 rounded-lg transition-colors"
          onClick={() => onRemove(localField.id)}
          title="Delete Field (Del)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    );
  };

  const renderTextField = () => (
    <div className="w-full h-full relative flex items-center">
      {isEditing ? (
        <input
          ref={inputRef}
          className="w-full h-full px-2 bg-white text-gray-900 border outline-none rounded"
          style={{ fontSize: `${fontSizePx}px`, borderColor: activeColor }}
          value={localField.value || ""}
          onChange={(e) => handleUpdate({ value: e.target.value })}
          onBlur={() => setIsEditing(false)}
          autoFocus
        />
      ) : (
        <div
          className="w-full h-full px-2 cursor-text flex items-center text-gray-900 font-medium select-none truncate"
          style={{ fontSize: `${fontSizePx}px` }}
          onClick={() => setIsEditing(true)}
        >
          {localField.value || (
            <span className="text-gray-400 italic font-normal">Click to enter text...</span>
          )}
        </div>
      )}
    </div>
  );

  const renderDateField = () => {
    const getDateValue = () => {
      if (!localField.value) return "";
      const d = new Date(localField.value);
      return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
    };

    return (
      <div className="w-full h-full relative flex items-center px-2">
        <input
          type="date"
          value={getDateValue()}
          onChange={(e) => {
            if (e.target.value) {
              const d = new Date(e.target.value);
              handleUpdate({ value: d.toLocaleDateString() });
            }
          }}
          className="w-full h-full bg-transparent text-gray-900 outline-none cursor-pointer font-medium"
          style={{ fontSize: `${fontSizePx}px` }}
        />
      </div>
    );
  };

  const renderSignatureField = () => (
    <div className="w-full h-full flex items-center justify-center p-1 overflow-hidden">
      {localField.signatureUrl || localField.value ? (
        <img
          src={localField.signatureUrl || localField.value}
          alt="Signature"
          className="w-full h-full object-contain pointer-events-none"
        />
      ) : (
        <div className="flex flex-col items-center justify-center space-y-0.5" style={{ color: activeColor }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="text-[10px] font-bold tracking-wider uppercase">
            {localField.type === "initials" ? "Initials" : "Signature"}
          </span>
        </div>
      )}
    </div>
  );

  const renderCheckboxField = () => {
    const isChecked = localField.checked || localField.value === true || localField.value === "true";
    const size = Math.min(w, h, fontSizePx * 1.3);

    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className={`rounded border-2 cursor-pointer flex items-center justify-center transition-all ${
            isChecked
              ? "text-white shadow-sm"
              : "bg-white border-gray-400 hover:border-gray-600"
          }`}
          style={{
            width: size,
            height: size,
            backgroundColor: isChecked ? activeColor : "#ffffff",
            borderColor: isChecked ? activeColor : "#9ca3af",
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleUpdate({ checked: !isChecked, value: !isChecked });
          }}
        >
          {isChecked && (
            <svg className="w-3/4 h-3/4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    );
  };

  const renderRadioField = () => {
    const isChecked = localField.checked || localField.value === true || localField.value === "true";
    const size = Math.min(w, h, fontSizePx * 1.2);
    const innerSize = size * 0.5;

    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className={`rounded-full border-2 cursor-pointer flex items-center justify-center transition-all ${
            isChecked
              ? "border-2 shadow-sm"
              : "bg-white border-gray-400 hover:border-gray-600"
          }`}
          style={{
            width: size,
            height: size,
            borderColor: isChecked ? activeColor : "#9ca3af",
            backgroundColor: isChecked ? activeColor : "#ffffff",
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleUpdate({ checked: !isChecked, value: !isChecked });
          }}
        >
          {isChecked && (
            <div
              className="rounded-full bg-white shadow-inner"
              style={{ width: innerSize, height: innerSize }}
            />
          )}
        </div>
      </div>
    );
  };

  const renderFieldContent = () => {
    switch (localField.type) {
      case "text":
        return renderTextField();
      case "date":
        return renderDateField();
      case "signature":
      case "initials":
        return renderSignatureField();
      case "checkbox":
        return renderCheckboxField();
      case "radio":
        return renderRadioField();
      default:
        return null;
    }
  };

  return (
    <Draggable
      position={{ x: xPx, y: yPx }}
      cancel=".react-resizable-handle, input, select, button"
      onStart={() => onSelect(localField.id)}
      onStop={(_, d) => {
        const xPercent = Math.min(Math.max(d.x / pageWidth, 0), 0.98);
        const yPercent = Math.min(Math.max(d.y / pageHeight, 0), 0.98);
        handleUpdate({ xPercent, yPercent });
      }}
    >
      <div
        ref={fieldRef}
        className="absolute cursor-move select-none"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(localField.id);
        }}
      >
        <ResizableBox
          width={w}
          height={h}
          resizeHandles={["se"]}
          minConstraints={localField.type === "radio" || localField.type === "checkbox" ? [24, 24] : [40, 24]}
          maxConstraints={[pageWidth - xPx, pageHeight - yPx]}
          onResizeStart={() => onSelect(localField.id)}
          onResizeStop={(_, { size }) => {
            handleUpdate({
              widthPercent: size.width / pageWidth,
              heightPercent: size.height / pageHeight,
            });
          }}
        >
          <div
            className={`w-full h-full relative rounded border transition-all ${
              isSelected
                ? "ring-2 shadow-xl"
                : "hover:border-opacity-100 bg-white/70 backdrop-blur-[1px]"
            }`}
            style={{
              borderColor: activeColor,
              backgroundColor: isSelected ? `${activeColor}20` : "rgba(255,255,255,0.7)",
              boxShadow: isSelected ? `0 0 0 2px ${activeColor}40` : "none",
            }}
          >
            {renderToolbar()}

            {renderFieldContent()}

            <div
              className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 border-r-2 border-b-2 pointer-events-none"
              style={{ borderColor: activeColor }}
            />
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
}
