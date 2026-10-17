import { useState, useEffect } from "react";
import { FIELD_TYPES } from "./fieldTypes";

/**
 * The field type following the pointer while it is dragged in or about to be placed.
 * It tracks the pointer coordinates independently so the main canvas does not re-render.
 */
export default function EditorGhost({ start, color, scale }) {
  const [at, setAt] = useState({ x: start.x, y: start.y });

  useEffect(() => {
    const follow = (event) => setAt({ x: event.clientX, y: event.clientY });
    window.addEventListener("pointermove", follow);
    return () => window.removeEventListener("pointermove", follow);
  }, []);

  const config = FIELD_TYPES[start.type];
  if (!config) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed z-[60] pointer-events-none rounded-[3px] border-2 flex items-center justify-center text-[10px] font-black uppercase"
      style={{
        left: at.x,
        top: at.y,
        width: config.size[0] * scale,
        height: config.size[1] * scale,
        transform: "translate(-50%, -50%)",
        borderColor: color,
        background: `${color}33`,
        color,
      }}
    >
      {config.square ? "" : config.label}
    </div>
  );
}
