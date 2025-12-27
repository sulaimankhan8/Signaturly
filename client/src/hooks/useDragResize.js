import { useState } from "react";

export const usePdfDimensions = () => {
  const [dims, setDims] = useState({ width: 0, height: 0 });
  return { dims, setDims };
};




/*import { useState } from "react";

export const useDragResize = (initial) => {
    const [position, setPosition] = useState(initial);

    const updatePosition = (x,y,pageWidth, pageHeight) =>{
        setPosition((s) => ({
            ...s,
            x: x / pageWidth,
            y: y / pageHeight,
        }));
    };

    const updateSize = (w, h, pageWidth, pageHeight) => {
        setPosition((s) => ({
            ...s,
            width: w / pageWidth,
            height: h / pageHeight,
        }));
    };

    return {
        position,
        updatePosition,
        updateSize,
    };
}*/