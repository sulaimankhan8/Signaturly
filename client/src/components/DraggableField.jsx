import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { useState, useEffect, useRef } from "react";
import "react-resizable/css/styles.css";

export default function DraggableField({
  field,
  pageWidth,
  pageHeight,
  onUpdate,
  onRemove,
}) {
  const [localField, setLocalField] = useState(field);
  const [isEditing, setIsEditing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef(null);

  // ---------------- SYNC PROPS ----------------
  useEffect(() => {
    console.log("[SYNC field -> localField]", field);
    setLocalField(field);
  }, [field]);

  // ---------------- POSITION & SIZE ----------------
  const xPx = localField.xPercent * pageWidth;
  const yPx = localField.yPercent * pageHeight;
  const w = localField.widthPercent * pageWidth;
  const h = localField.heightPercent * pageHeight;

  console.log("[LAYOUT]", {
    type: localField.type,
    xPx,
    yPx,
    w,
    h,
  });

  // ---------------- FONT SIZE (SINGLE SOURCE OF TRUTH) ----------------
  const fontSizePx = localField.fontSizePercent
    ? localField.fontSizePercent * pageHeight
    : h * 0.6;

  console.log("[FONT SIZE]", {
    type: localField.type,
    fontSizePercent: localField.fontSizePercent,
    fontSizePx,
  });

  // ---------------- UPDATE HELPER ----------------
  const handleUpdate = (updates) => {
    const updated = { ...localField, ...updates };
    console.log("[UPDATE FIELD]", {
      type: localField.type,
      before: localField,
      updates,
      after: updated,
    });
    setLocalField(updated);
    onUpdate(updated);
  };

  // ---------------- FONT CONTROLS ----------------
  const handleFontSizeChange = (delta) => {
    const nextPx = Math.max(8, Math.min(72, fontSizePx + delta));
    console.log("[FONT INC/DEC]", {
      type: localField.type,
      delta,
      oldPx: fontSizePx,
      newPx: nextPx,
      newPercent: nextPx / pageHeight,
    });
    handleUpdate({ fontSizePercent: nextPx / pageHeight });
  };

  const renderFontControls = () => (
    <div className="absolute top-0 right-0 flex bg-white shadow-md rounded-bl z-10">
      <button
        className="px-2 py-1 text-xs hover:bg-orange-500 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          handleFontSizeChange(-1);
        }}
      >
        −
      </button>
      <button
        className="px-2 py-1 text-xs hover:bg-orange-500 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          handleFontSizeChange(1);
        }}
      >
        +
      </button>
    </div>
  );

  // ================= TEXT FIELD =================
  const renderTextField = () => {
    console.log("[RENDER TEXT]");
    return (
      <div className="w-full h-full relative">
        {isEditing ? (
          <input
            ref={inputRef}
            className="w-full h-full px-2 bg-transparent outline-none"
            style={{ fontSize: fontSizePx }}
            value={localField.value || ""}
            onChange={(e) => handleUpdate({ value: e.target.value })}
            onBlur={() => setIsEditing(false)}
            autoFocus
          />
        ) : (
          <div
            className="w-full h-full px-2 cursor-text flex items-center"
            style={{ fontSize: fontSizePx }}
            onClick={() => setIsEditing(true)}
          >
            {localField.value || (
              <span className="text-gray-500 opacity-60">Click to edit</span>
            )}
          </div>
        )}
        {renderFontControls()}
      </div>
    );
  };

  // ================= DATE FIELD =================
  const renderDateField = () => {
    console.log("[RENDER DATE]");
    const getDateValue = () => {
      if (!localField.value) return "";
      const d = new Date(localField.value);
      return isNaN(d) ? "" : d.toISOString().split("T")[0];
    };

    return (
      <div className="w-full h-full relative flex items-center ">
        <input
          type="date"
          value={getDateValue()}
          onChange={(e) => {
            const d = new Date(e.target.value);
            console.log("[DATE CHANGE]", d);
            handleUpdate({ value: d.toLocaleDateString() });
          }}
          className="w-full h-full bg-transparent outline-none text-center cursor-pointer"
          style={{
  fontSize: fontSizePx,
  paddingLeft: "0px",
          textAlign: "left",
  paddingTop: `${fontSizePx * 0.01}px`,
 
}}

        />
        {renderFontControls()}
      </div>
    );
  };

  // ================= SIGNATURE =================
  const renderSignatureField = () => {
    console.log("[RENDER SIGNATURE]");
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        {localField.signatureUrl ? (
          <img
            src={localField.signatureUrl}
            alt="signature"
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-gray-500 opacity-60 text-xs">SIGN</span>
        )}
      </div>
    );
  };

  // ================= RADIO =================
  const renderRadioField = () => {
    console.log("[RENDER RADIO]");
    const size = fontSizePx;
    const innerSize = size * 0.5;

    console.log("[RADIO SIZE]", { size, innerSize });

    return (
      <div className="w-full h-full relative flex items-center justify-center">
        <div
          className={`rounded-full border-2 cursor-pointer flex items-center justify-center ${
            localField.checked
              ? "bg-orange-500 border-orange-500"
              : "bg-white border-gray-400"
          }`}
          style={{ width: size, height: size }}
          onClick={(e) => {
            e.stopPropagation();
            console.log("[RADIO TOGGLE]", !localField.checked);
            handleUpdate({ checked: !localField.checked });
          }}
        >
          {localField.checked && (
            <div
              className="rounded-full bg-white"
              style={{ width: innerSize, height: innerSize }}
            />
          )}
        </div>
        {renderFontControls()}
      </div>
    );
  };

  // ================= FIELD SWITCH =================
  const renderFieldContent = () => {
    console.log("[RENDER FIELD TYPE]", localField.type);
    switch (localField.type) {
      case "text":
        return renderTextField();
      case "date":
        return renderDateField();
      case "signature":
        return renderSignatureField();
      case "radio":
        return renderRadioField();
      default:
        return null;
    }
  };

  // ================= RENDER =================
  return (
    <Draggable
      position={{ x: xPx, y: yPx }}
      cancel=".react-resizable-handle"
      onStop={(_, d) => {
        console.log("[DRAG STOP]", d);
        handleUpdate({
          xPercent: Math.min(Math.max(d.x / pageWidth, 0), 1),
          yPercent: Math.min(Math.max(d.y / pageHeight, 0), 1),
        });
      }}
    >
      <div className="absolute">
        <ResizableBox
          width={w}
          height={h}
          resizeHandles={["se"]}
          minConstraints={
            localField.type === "radio" ? [30, 30] : [50, 24]
          }
          maxConstraints={[pageWidth, pageHeight]}
          onResizeStop={(_, { size }) => {
            console.log("[RESIZE STOP]", size);
            handleUpdate({
              widthPercent: size.width / pageWidth,
              heightPercent: size.height / pageHeight,
            });
          }}
        >
          <div
            className="border border-gray-300 w-full h-full relative overflow-hidden flex items-center justify-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <button
              className="absolute top-0 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded-br z-20"
              onClick={(e) => {
                e.stopPropagation();
                console.log("[REMOVE FIELD]", localField.id);
                onRemove(localField.id);
              }}
            >
              ✕
            </button>

            {renderFieldContent()}

            <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-orange-500 rotate-45" />

            {showTooltip && (
              <div className="absolute -top-7 left-0 bg-black text-white text-xs px-2 py-1 rounded">
                {localField.type}
              </div>
            )}
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
}
