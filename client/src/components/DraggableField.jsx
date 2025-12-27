import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { useState, useEffect, useRef } from "react";
import "react-resizable/css/styles.css";

export default function DraggableField({
  field,
  pageWidth,
  pageHeight,
  onUpdate,
}) {
  const [localField, setLocalField] = useState(field);
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
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
const fontSizePx =
  localField.fontSizePercent
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
  
  /* Handle drag stop
  const handleDragStop = (_, d) => {
  const xPercent = d.x / pageWidth;
 const yPercent = d.y / pageHeight;

  onUpdate({
    ...localField,
    xPercent: Math.max(0, Math.min(1, xPercent)),
    yPercent: Math.max(0, Math.min(1, yPercent)),
  });
};
console.log("FIELD %", field.xPercent, field.yPercent);
*/
  
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

  
  // Handle resize (during resize operation)
  //const handleResize = (_, { size }) => {
    // This is called during resize, but we only update on stop to avoid excessive re-renders
  //};
  
  // Render text field with font size controls
  const renderTextField = () => {
    return (
      <div className="w-full h-full relative">
        {isEditing ? (
          <input
            ref={inputRef}
            className="w-full h-full px-1 outline-none"
            style={{ fontSize: `${fontSizePx}px` }}
            value={localField.value}
            onChange={handleTextChange}
            onBlur={() => setIsEditing(false)}
            autoFocus
          />
        ) : (
          <div
            className="w-full h-full px-1 cursor-text flex items-center"
            style={{ fontSize: `${fontSizePx}px` }}
            onClick={() => setIsEditing(true)}
          >
            {localField.value || <span className="text-gray-400">Click to edit</span>}
          </div>
        )}
        
        {/* Font size controls */}
        <div className="absolute top-0 right-0 flex bg-white shadow-md rounded-bl z-10">
          <button
            className="px-1 text-xs hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation();
              handleFontSizeChange(-1);
            }}
          >
            A-
          </button>
          <button
            className="px-1 text-xs hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation();
              handleFontSizeChange(1);
            }}
          >
            A+
          </button>
        </div>
      </div>
    );
  };
  
  // Render date field
  const renderDateField = () => {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ fontSize: `${fontSizePx}px` }}>
        {localField.value || <span className="text-gray-400">Date</span>}
      </div>
    );
  };
  
  // Render signature field - FIXED for proper resizing
  const renderSignatureField = () => {
    return (
      <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-gray-50">
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
          <span className="opacity-60 text-gray-500">SIGN</span>
        )}
      </div>
    );
  };
   
  // Render radio button field
  const renderRadioField = () => {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className={`h-6 w-6 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all ${
            localField.checked 
              ? "bg-green-500 border-green-500" 
              : "bg-white border-gray-600 hover:border-green-400"
          }`}
          onClick={handleRadioToggle}
        >
          {localField.checked && (
            <div className="h-3 w-3 rounded-full bg-white"></div>
          )}
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
    console.log("DRAG STOP", { xPercent, yPercent });
  onUpdate({
    ...localField,
    xPercent: Math.min(Math.max(xPercent, 0), 1),
    yPercent: Math.min(Math.max(yPercent, 0), 1),
  });
}}

>



      <div className="absolute ">
        <ResizableBox
          width={w}
          height={h}
          minConstraints={[30, 20]}
          maxConstraints={[pageWidth, pageHeight]}
          resizeHandles={["n", "e", "s", "w", "ne", "nw", "se", "sw"]}
          onResizeStart={handleResizeStart}
          //onResize={handleResize}
          onResizeStop={handleResizeStop}
          className={`hover:outline hover:outline-2 hover:outline-blue-500 ${
            isResizing ? "outline outline-2 outline-blue-500" : ""
          }`}
        >
          <div className="border bg-white-400 w-full h-full text-xs flex items-center justify-center relative overflow-hidden">
            {renderFieldContent()}
            
            {/* Field type indicator */}
            <div className="absolute bottom-0 left-0 text-xs bg-gray-200 px-1 opacity-50">
              {localField.type}
            </div>
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
}