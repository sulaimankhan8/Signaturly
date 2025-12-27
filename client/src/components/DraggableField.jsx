import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { useState, useEffect, useRef } from "react";
import "react-resizable/css/styles.css";

import "react-datepicker/dist/react-datepicker.css";

export default function DraggableField({
  field,
  pageWidth,
  pageHeight,
  onUpdate,
  onRemove,
}) {
  const [localField, setLocalField] = useState(field);
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef(null);
  
  // Update local state when props change
  useEffect(() => {
    setLocalField(field);
  }, [field]);
  
  // Calculate position and size
  const xPx = localField.xPercent * pageWidth;
  const yPx = localField.yPercent * pageHeight;
  const w = localField.widthPercent * pageWidth;
  const h = localField.heightPercent * pageHeight;
  
  // Default font size based on field height if not specified
  const fontSizePx = localField.fontSizePercent
    ? localField.fontSizePercent * pageHeight
    : h * 0.6;
  
  // Handle field updates
  const handleUpdate = (updates) => {
    const newField = { ...localField, ...updates };
    setLocalField(newField);
    onUpdate(newField);
  };
  
  // Handle text field changes
  const handleTextChange = (e) => {
    handleUpdate({ value: e.target.value });
  };
  
  // Handle font size changes
  const handleFontSizeChange = (delta) => {
    const currentPx = fontSizePx;
    const nextPx = Math.max(8, Math.min(72, currentPx + delta));
    
    handleUpdate({
      fontSizePercent: nextPx / pageHeight,
    });
  };
  
  // Handle radio button toggle
  const handleRadioToggle = (e) => {
    e.stopPropagation();
    handleUpdate({ checked: !localField.checked });
  };
  
  // Handle date selection
  const handleDateChange = (date) => {
    const formattedDate = date.toLocaleDateString();
    handleUpdate({ value: formattedDate });
    setShowDatePicker(false);
  };
  
  // Handle resize start
  const handleResizeStart = () => {
    setIsResizing(true);
  };
  
  // Handle resize stop
  const handleResizeStop = (_, { size }) => {
    setIsResizing(false);
    
    const heightPercent = size.height / pageHeight;
    const fontSizePercent = (size.height * 0.6) / pageHeight;
    
    onUpdate({
      ...localField,
      widthPercent: size.width / pageWidth,
      heightPercent,
      fontSizePercent,
    });
  };
  
  // Render text field with font size controls
  const renderTextField = () => {
    return (
      <div className="w-full h-full relative">
        {isEditing ? (
          <input
            ref={inputRef}
            className="w-full h-full px-2 outline-none bg-transparent"
            style={{ fontSize: `${fontSizePx}px` }}
            value={localField.value}
            onChange={handleTextChange}
            onBlur={() => setIsEditing(false)}
            autoFocus
          />
        ) : (
          <div
            className="w-full h-full px-2 cursor-text flex items-center"
            style={{ fontSize: `${fontSizePx}px` }}
            onClick={() => setIsEditing(true)}
          >
            {localField.value || <span className="text-gray-500 opacity-60">Click to edit</span>}
          </div>
        )}
        
        {/* Font size controls */}
        <div className="absolute top-0 right-0 flex bg-white shadow-md rounded-bl z-10">
          <button
            className="px-2 py-1 text-xs hover:bg-orange-500 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleFontSizeChange(-1);
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            className="px-2 py-1 text-xs hover:bg-orange-500 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleFontSizeChange(1);
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    );
  };
  
  // Render date field with native HTML5 date picker
const renderDateField = () => {
  // Convert the stored date string back to YYYY-MM-DD format for the input
  const getDateValue = () => {
    if (!localField.value) return "";
    try {
      const date = new Date(localField.value);
      return date.toISOString().split('T')[0];
    } catch {
      return "";
    }
  };
  
  return (
    <div className="w-full h-full relative">
      <input
        type="date"
        value={getDateValue()}
        onChange={(e) => {
          const date = new Date(e.target.value);
          const formattedDate = date.toLocaleDateString();
          handleUpdate({ value: formattedDate });
        }}
        className="w-full h-full px-2 bg-transparent outline-none cursor-pointer"
        style={{ fontSize: `${fontSizePx}px` }}
      />
      
      {/* Font size controls */}
      <div className="absolute top-0 right-0 flex bg-white shadow-md rounded-bl z-10">
        <button
          className="px-2 py-1 text-xs hover:bg-orange-500 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleFontSizeChange(-1);
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          className="px-2 py-1 text-xs hover:bg-orange-500 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleFontSizeChange(1);
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      
      {/* Calendar icon overlay */}
      <div className="absolute right-2 pointer-events-none">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
};
  
  // Render signature field
  const renderSignatureField = () => {
    return (
      <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
        {localField.signatureUrl ? (
          <img
            src={localField.signatureUrl}
            alt="signature"
            className="max-w-full max-h-full object-contain"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 opacity-60">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-xs">SIGN</span>
          </div>
        )}
      </div>
    );
  };
   
  
  // Render radio button field
const renderRadioField = () => {
  return (
    <div className="w-full h-full relative">
      <div className="w-full h-full flex items-center justify-center">
        <div
          className={`rounded-full border-2 cursor-pointer flex items-center justify-center transition-all ${
            localField.checked 
              ? "bg-orange-500 border-orange-500" 
              : "bg-white border-gray-400 hover:border-orange-400"
          }`}
          style={{
            width: `${fontSizePx}px`,
            height: `${fontSizePx}px`
          }}
          onClick={handleRadioToggle}
        >
          {localField.checked && (
            <div 
              className="rounded-full "
              style={{
                width: `${fontSizePx * 0.5}px`,
                height: `${fontSizePx * 0.5}px`
              }}
            ></div>
          )}
        </div>
      </div>
      
      {/* Font size controls */}
      <div className="absolute top-0 right-0 flex bg-white shadow-md rounded-bl z-10">
        <button
          className="px-2 py-1 text-xs hover:bg-orange-500 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleFontSizeChange(-1);
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          className="px-2 py-1 text-xs hover:bg-orange-500 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleFontSizeChange(1);
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
};
  
  // Render the appropriate field type
  const renderFieldContent = () => {
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
  
  return (
    <Draggable
      position={{ x: xPx, y: yPx }}
      cancel=".react-resizable-handle"
      onStop={(_, d) => {
        const xPercent = d.x / pageWidth;
        const yPercent = d.y / pageHeight;
        
        onUpdate({
          ...localField,
          xPercent: Math.min(Math.max(xPercent, 0), 1),
          yPercent: Math.min(Math.max(yPercent, 0), 1),
        });
      }}
    >
      <div className="absolute">
        <ResizableBox
          width={w}
          height={h}
          minConstraints={[30, 20]}
          maxConstraints={[pageWidth, pageHeight]}
          resizeHandles={["se"]}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          className={`hover:outline hover:outline-2 hover:outline-orange-500 ${
            isResizing ? "outline outline-2 outline-orange-500" : ""
          }`}
        >
          <div 
            className="border border-gray-300 border-opacity-50 bg-transparent w-full h-full text-xs flex items-center justify-center relative overflow-hidden"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {/* Delete button */}
<button
  className="absolute top-0 left-0 z-20 bg-red-500 text-white rounded-br px-2 py-1 text-xs hover:bg-red-600"
  onClick={(e) => {
    e.stopPropagation();
    onRemove(localField.id);
  }}
>
  ✕
</button>

            {renderFieldContent()}
            
            {/* Resize handle indicator */}
            <div className="absolute bottom-0 right-0 w-4 h-4">
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-orange-500 transform rotate-45"></div>
            </div>
            
            {/* Tooltip for field type */}
            {showTooltip && (
              <div className="absolute -top-8 left-0 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                {localField.type}
              </div>
            )}
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
}