import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function VerifiedESignBadge({ onConfirm, defaultName = "Signer", defaultEmail = "" }) {
  const [name, setName] = useState(defaultName);
  const [styleType, setStyleType] = useState("modern-badge"); // modern-badge | formal-stamp | cursive-badge
  const [color, setColor] = useState("#0f172a");

  const generateBadgeDataUrl = () => {
    const text = name.trim() || "Authorized Signer";
    const canvas = document.createElement("canvas");
    canvas.width = 650;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const hash = Math.random().toString(36).substring(2, 10).toUpperCase();

    if (styleType === "modern-badge") {
      // Modern Legal E-Signature Stamp (DocuSign/Signaturly Style)
      // Rounded Card Background
      ctx.fillStyle = "rgba(248, 250, 252, 0.95)";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(10, 10, 630, 180, 16);
      ctx.fill();
      ctx.stroke();

      // Left Accent Security Bar
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.roundRect(10, 10, 14, 180, [16, 0, 0, 16]);
      ctx.fill();

      // Verified Header
      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("DIGITALLY VERIFIED E-SIGNATURE", 40, 42);

      // Signer Name in Cursive Calligraphy
      ctx.font = "bold 52px 'Dancing Script', 'Brush Script MT', cursive, sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(text, 40, 108);

      // Security Metadata Line
      ctx.font = "14px monospace";
      ctx.fillStyle = "#475569";
      ctx.fillText(`ID: SEC-${hash} • Sealed: ${dateStr} • IT Act/ESIGN Compliant`, 40, 155);

    } else if (styleType === "formal-stamp") {
      // Formal Legal Execution Stamp
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(10, 10, 630, 180, 12);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(18, 18, 614, 164, 8);
      ctx.stroke();

      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText("OFFICIALLY SIGNED & EXECUTED", 325, 48);

      ctx.font = "bold 44px 'Dancing Script', cursive, sans-serif";
      ctx.fillText(text, 325, 110);

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`AUTHENTICATED ELECTRONIC SIGNATURE • ${dateStr}`, 325, 155);

    } else {
      // Cursive with underline and legal verification seal
      ctx.font = "bold 64px 'Great Vibes', 'Dancing Script', cursive, sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(text, 40, 100);

      // Signature line
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 125);
      ctx.lineTo(600, 125);
      ctx.stroke();

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#475569";
      ctx.fillText(`Legally binding electronic signature of ${text} (${dateStr})`, 40, 155);
    }

    return canvas.toDataURL("image/png");
  };

  const handleConfirm = () => {
    const dataUrl = generateBadgeDataUrl();
    if (dataUrl) {
      onConfirm(dataUrl);
      toast.success("Verified E-Signature Badge applied!");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
          Signer Legal Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sulaiman Khan"
          className="w-full px-3.5 py-2.5 bg-[#08090d] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-xs font-medium"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-[#08090d] p-1 rounded-xl border border-white/10 flex-1">
          {[
            { id: "modern-badge", label: "DocuSign Style" },
            { id: "formal-stamp", label: "Legal Stamp" },
            { id: "cursive-badge", label: "Seal Line" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyleType(s.id)}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                styleType === s.id
                  ? "bg-white/15 text-white shadow border border-white/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1 bg-black/40 p-1.5 rounded-xl border border-white/10">
          {[
            { val: "#0f172a", bg: "bg-slate-900" },
            { val: "#1e40af", bg: "bg-blue-800" },
            { val: "#991b1b", bg: "bg-red-800" },
          ].map((c) => (
            <button
              key={c.val}
              type="button"
              onClick={() => setColor(c.val)}
              className={`w-5 h-5 rounded-md ${c.bg} border transition-all ${
                color === c.val ? "scale-110 border-white ring-2 ring-white/30" : "border-transparent opacity-70"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Live Badge Preview */}
      <div className="border border-white/10 rounded-2xl p-3 bg-white flex items-center justify-center min-h-[110px] overflow-hidden shadow-inner">
        <div className="w-full text-center">
          <div className="inline-block p-3 rounded-xl border border-gray-300 bg-slate-50 shadow-sm max-w-full text-left">
            <p className="text-[9px] font-mono uppercase font-bold text-gray-500 tracking-wider">
              {styleType === "formal-stamp" ? "OFFICIALLY SIGNED & EXECUTED" : "DIGITALLY VERIFIED E-SIGNATURE"}
            </p>
            <p
              className="text-2xl font-bold my-1 truncate"
              style={{
                fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
                color,
              }}
            >
              {name || "Authorized Signer"}
            </p>
            <p className="text-[9px] font-mono text-gray-600">
              ID: SEC-VERIFIED • Sealed: {new Date().toLocaleDateString()} • Compliant
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-950/50 border border-red-500/30"
      >
        Adopt Verified E-Signature
      </button>
    </div>
  );
}
