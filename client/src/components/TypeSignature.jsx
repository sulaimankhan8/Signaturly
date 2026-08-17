import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

const CURSIVE_FONTS = [
  { name: "Dancing Script", font: "'Dancing Script', cursive", size: 36 },
  { name: "Great Vibes", font: "'Great Vibes', cursive", size: 40 },
  { name: "Pacifico", font: "'Pacifico', cursive", size: 32 },
  { name: "Caveat", font: "'Caveat', cursive", size: 38 },
];

export default function TypeSignature({ onConfirm, defaultText = "" }) {
  const [typedName, setTypedName] = useState(defaultText);
  const [selectedFont, setSelectedFont] = useState(CURSIVE_FONTS[0].font);
  const [color, setColor] = useState("#000000");
  const previewCanvasRef = useRef(null);

  // Load Google Fonts dynamically
  useEffect(() => {
    const linkId = "google-cursive-fonts";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const generateSignatureImage = () => {
    const text = typedName.trim();
    if (!text) {
      toast.error("Please enter your name to generate a signature");
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `64px ${selectedFont}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL("image/png");
  };

  const handleConfirm = () => {
    const dataUrl = generateSignatureImage();
    if (dataUrl) {
      onConfirm(dataUrl);
      toast.success("Typed signature generated!");
    }
  };

  return (
    <div className="space-y-4">
      {/* Name Input */}
      <div>
        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
          Type Your Full Name / Signature
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="e.g. Eleanor Vance"
          className="w-full px-3.5 py-2.5 bg-[#08090d] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-xs font-medium"
        />
      </div>

      {/* Font & Color Selectors */}
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

        <select
          value={selectedFont}
          onChange={(e) => setSelectedFont(e.target.value)}
          className="bg-[#08090d] border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-500"
        >
          {CURSIVE_FONTS.map((f) => (
            <option key={f.name} value={f.font}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Signature Preview */}
      <div className="border border-white/10 rounded-2xl p-4 bg-white min-h-[100px] flex items-center justify-center shadow-inner overflow-hidden">
        {typedName.trim() ? (
          <span
            style={{
              fontFamily: selectedFont,
              color,
              fontSize: "36px",
              lineHeight: 1.2,
            }}
            className="select-none text-center"
          >
            {typedName}
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">Signature preview will appear here</span>
        )}
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!typedName.trim()}
        className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-950/50 border border-red-500/30"
      >
        Use Typed Signature
      </button>
    </div>
  );
}
