import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

const CURSIVE_FONTS = [
  { name: "Great Vibes (Executive Cursive)", font: "'Great Vibes', cursive", size: 40 },
  { name: "Dancing Script (Fluid Penmanship)", font: "'Dancing Script', cursive", size: 36 },
  { name: "Caveat (Natural Pen)", font: "'Caveat', cursive", size: 38 },
  { name: "Alex Brush (Calligraphy Quill)", font: "'Alex Brush', cursive", size: 40 },
];

export default function TypeSignature({ onConfirm, defaultText = "" }) {
  const [typedName, setTypedName] = useState(defaultText);
  const [selectedFont, setSelectedFont] = useState(CURSIVE_FONTS[0].font);
  const [color, setColor] = useState("#000000");

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
        <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-1.5">
          Type Your Full Name / Signature
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="e.g. Eleanor Vance"
          className="w-full px-3.5 py-2.5 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-xs font-medium"
        />
      </div>

      {/* Font & Color Selectors */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center space-x-1.5 bg-[#090a0f] p-1.5 rounded-xl border-2 border-white/20">
          {[
            { name: "Black", val: "#000000", hex: "bg-black" },
            { name: "Blue", val: "#1d4ed8", hex: "bg-blue-600" },
            { name: "Red", val: "#b91c1c", hex: "bg-red-600" },
          ].map((c) => (
            <button
              key={c.val}
              type="button"
              onClick={() => setColor(c.val)}
              className={`w-6 h-6 rounded-lg ${c.hex} border-2 transition-all ${
                color === c.val ? "scale-110 border-white ring-2 ring-yellow-400" : "border-black/50 opacity-70"
              }`}
              title={c.name}
            />
          ))}
        </div>

        <select
          value={selectedFont}
          onChange={(e) => setSelectedFont(e.target.value)}
          className="bg-[#090a0f] border-2 border-white/20 text-white text-xs font-black uppercase tracking-wider rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-400"
        >
          {CURSIVE_FONTS.map((f) => (
            <option key={f.name} value={f.font}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Signature Preview */}
      <div className="border-2 border-black rounded-2xl p-4 bg-white min-h-[110px] flex items-center justify-center shadow-[4px_4px_0px_0px_#000] overflow-hidden">
        {typedName.trim() ? (
          <span
            style={{
              fontFamily: selectedFont,
              color,
              fontSize: "42px",
              lineHeight: 1.2,
            }}
            className="select-none text-center"
          >
            {typedName}
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic font-medium">Signature preview will appear here</span>
        )}
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!typedName.trim()}
        className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black uppercase tracking-wider rounded-xl text-xs transition-all shadow-[3px_3px_0px_0px_#facc15] border-2 border-black hover:-translate-x-0.5 hover:-translate-y-0.5"
      >
        Use Typed Signature →
      </button>
    </div>
  );
}

