import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

export default function InitialsStudio({ onConfirm, defaultName = "" }) {
  const defaultInitials = defaultName
    ? defaultName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 3)
    : "SK";

  const [mode, setMode] = useState("type"); // type | draw
  const [initialsText, setInitialsText] = useState(defaultInitials);
  const [badgeStyle, setBadgeStyle] = useState("monogram-circle"); // monogram-circle | monogram-square | handwritten
  const [color, setColor] = useState("#000000");

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const strokesRef = useRef([]);

  useEffect(() => {
    if (mode === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
      redraw();
    }
  }, [mode]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      color,
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
      ctx.lineWidth = 3;
      ctx.moveTo(stroke[0].x, stroke[0].y);
      stroke.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
  };

  const generateInitialsImage = () => {
    const text = (initialsText || "SK").trim().toUpperCase();
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, 240, 240);

    if (badgeStyle === "monogram-circle") {
      // Circle Badge
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(120, 120, 105, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = "bold 90px 'Dancing Script', cursive, sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 120, 120);

    } else if (badgeStyle === "monogram-square") {
      // Rounded Square Box
      ctx.fillStyle = "rgba(241, 245, 249, 0.9)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(15, 15, 210, 210, 24);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 80px sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 120, 120);

    } else {
      // Free cursive initials
      ctx.font = "bold 110px 'Dancing Script', 'Great Vibes', cursive, sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 120, 120);
    }

    return canvas.toDataURL("image/png");
  };

  const handleConfirm = () => {
    if (mode === "draw") {
      if (strokesRef.current.length === 0) {
        toast.error("Please draw your initials first");
        return;
      }
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onConfirm(dataUrl);
      toast.success("Drawn initials adopted!");
    } else {
      const dataUrl = generateInitialsImage();
      onConfirm(dataUrl);
      toast.success("Initials generated!");
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex bg-[#08090d] p-1 rounded-xl border border-white/10">
        <button
          type="button"
          onClick={() => setMode("type")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            mode === "type" ? "bg-white/15 text-white shadow border border-white/20" : "text-gray-400 hover:text-white"
          }`}
        >
          Type / Monogram
        </button>
        <button
          type="button"
          onClick={() => setMode("draw")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            mode === "draw" ? "bg-white/15 text-white shadow border border-white/20" : "text-gray-400 hover:text-white"
          }`}
        >
          Draw Initials
        </button>
      </div>

      {mode === "type" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                Initials Text (2-3 chars)
              </label>
              <input
                type="text"
                maxLength={4}
                value={initialsText}
                onChange={(e) => setInitialsText(e.target.value.toUpperCase())}
                placeholder="SK"
                className="w-full px-3 py-2 bg-[#08090d] border border-white/10 rounded-xl text-white font-mono text-center font-bold tracking-widest text-base focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center space-x-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 mt-5">
              {[
                { val: "#000000", hex: "bg-black" },
                { val: "#1e3a8a", hex: "bg-blue-900" },
                { val: "#991b1b", hex: "bg-red-800" },
              ].map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => setColor(c.val)}
                  className={`w-6 h-6 rounded-lg ${c.hex} border transition-all ${
                    color === c.val ? "scale-110 border-white ring-2 ring-white/30" : "border-transparent opacity-70"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex bg-[#08090d] p-1 rounded-xl border border-white/10">
            {[
              { id: "monogram-circle", label: "Circle Seal" },
              { id: "monogram-square", label: "Badge" },
              { id: "handwritten", label: "Cursive" },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBadgeStyle(b.id)}
                className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  badgeStyle === b.id ? "bg-white/20 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Preview Box */}
          <div className="border border-white/10 rounded-2xl p-4 bg-white flex items-center justify-center min-h-[110px] shadow-inner">
            <div
              className={`w-20 h-20 flex items-center justify-center ${
                badgeStyle === "monogram-circle"
                  ? "rounded-full border-2"
                  : badgeStyle === "monogram-square"
                  ? "rounded-xl border-2 bg-slate-50 shadow-sm"
                  : ""
              }`}
              style={{ borderColor: color }}
            >
              <span
                style={{
                  fontFamily: badgeStyle === "monogram-square" ? "sans-serif" : "'Dancing Script', cursive",
                  color,
                  fontSize: badgeStyle === "monogram-square" ? "28px" : "34px",
                  fontWeight: "bold",
                }}
              >
                {initialsText || "SK"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="border border-white/10 rounded-2xl h-40 bg-white shadow-inner relative overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none cursor-crosshair"
              onPointerDown={(e) => {
                e.preventDefault();
                setDrawing(true);
                strokesRef.current.push([getPos(e)]);
              }}
              onPointerMove={(e) => {
                if (!drawing) return;
                strokesRef.current.at(-1).push(getPos(e));
                redraw();
              }}
              onPointerUp={() => setDrawing(false)}
              onPointerLeave={() => setDrawing(false)}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              strokesRef.current = [];
              redraw();
            }}
            className="text-[11px] text-gray-400 hover:text-red-400 underline font-semibold"
          >
            Clear Initials Pad
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-950/50 border border-red-500/30"
      >
        Adopt Initials Mark
      </button>
    </div>
  );
}
