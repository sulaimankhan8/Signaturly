import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

export default function SignaturePad({ onConfirm, defaultColor = "#000000" }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(defaultColor);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const strokesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    redraw();
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pressure || 0.5,
      color,
      width: strokeWidth,
    };
  };

  const redraw = () => {
    const ctx = ctxRef.current;
    if (!ctx || !canvasRef.current) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    strokesRef.current.forEach((stroke) => {
      if (!stroke || stroke.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke[0].color || "#000000";
      ctx.lineWidth = (stroke[0].width || 2) + stroke[0].p * 1.5;
      ctx.moveTo(stroke[0].x, stroke[0].y);

      stroke.forEach((p) => {
        ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  };

  const down = (e) => {
    e.preventDefault();
    setDrawing(true);
    strokesRef.current.push([getPos(e)]);
  };

  const move = (e) => {
    if (!drawing) return;
    strokesRef.current.at(-1).push(getPos(e));
    redraw();
  };

  const up = () => setDrawing(false);

  const clear = () => {
    strokesRef.current = [];
    redraw();
  };

  const undo = () => {
    if (strokesRef.current.length > 0) {
      strokesRef.current.pop();
      redraw();
    }
  };

  const confirm = async () => {
    if (strokesRef.current.length === 0) {
      toast.error("Please draw a signature first");
      return;
    }

    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    onConfirm(dataUrl);
    toast.success("Signature captured!");
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
          {[
            { name: "Black", val: "#000000", hex: "bg-black" },
            { name: "Blue", val: "#1d4ed8", hex: "bg-blue-600" },
            { name: "Red", val: "#b91c1c", hex: "bg-red-600" },
          ].map((c) => (
            <button
              key={c.val}
              type="button"
              onClick={() => setColor(c.val)}
              className={`w-6 h-6 rounded-lg ${c.hex} border transition-all ${
                color === c.val ? "scale-110 border-white ring-2 ring-white/30" : "border-transparent opacity-70"
              }`}
              title={c.name}
            />
          ))}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[10px] uppercase font-mono text-gray-400">Stroke:</span>
          <input
            type="range"
            min="1"
            max="5"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="w-16 accent-red-500"
          />
        </div>
      </div>

      {/* Canvas Pad */}
      <div className="border-2 border-dashed border-white/10 hover:border-red-500/50 rounded-2xl h-40 bg-white overflow-hidden shadow-inner transition-colors relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
        <span className="absolute bottom-2 right-3 text-[10px] font-mono text-gray-400 pointer-events-none select-none">
          Draw with mouse, touch or pen
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clear}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs transition-colors border border-white/10"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={undo}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs transition-colors border border-white/10"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={confirm}
          className="ml-auto px-5 py-2 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-950/50 border border-red-500/30"
        >
          Attach Signature
        </button>
      </div>
    </div>
  );
}
