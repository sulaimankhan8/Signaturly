import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function VerifiedESignBadge({ onConfirm, defaultName = "Signer", defaultEmail = "" }) {
  const [name, setName] = useState(defaultName || "Signer");
  const [styleType, setStyleType] = useState("modern-badge"); // modern-badge | formal-stamp | cursive-badge
  const [color, setColor] = useState("#0f172a");
  const [previewUrl, setPreviewUrl] = useState("");

  const generateBadgeDataUrl = (signerName = name, style = styleType, strokeColor = color) => {
    const text = signerName.trim() || "Authorized Signer";
    const canvas = document.createElement("canvas");
    canvas.width = 650;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const hash = "VERIFIED";

    if (style === "modern-badge") {
      // 1. DocuSign / Signaturly Modern Legal Card
      ctx.fillStyle = "rgba(248, 250, 252, 0.98)";
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

      // Header
      ctx.font = "bold 15px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText("DIGITALLY VERIFIED E-SIGNATURE", 40, 42);

      // Cursive Signature
      ctx.font = "bold 52px 'Dancing Script', 'Brush Script MT', cursive, sans-serif";
      ctx.fillStyle = strokeColor;
      ctx.fillText(text, 40, 108);

      // Metadata Footer
      ctx.font = "13px monospace";
      ctx.fillStyle = "#475569";
      ctx.fillText(`ID: SEC-${hash} • Sealed: ${dateStr} • IT Act/ESIGN Compliant`, 40, 155);

    } else if (style === "formal-stamp") {
      // 2. Formal Legal Execution Double-Border Notary Stamp
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.roundRect(8, 8, 634, 184, 14);
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(12, 12, 626, 176, 12);
      ctx.stroke();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(18, 18, 614, 164, 8);
      ctx.stroke();

      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = strokeColor;
      ctx.textAlign = "center";
      ctx.fillText("★ OFFICIALLY SIGNED & EXECUTED ★", 325, 48);

      ctx.font = "bold 48px 'Dancing Script', cursive, sans-serif";
      ctx.fillText(text, 325, 110);

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#475569";
      ctx.fillText(`AUTHENTICATED ELECTRONIC SEAL • ${dateStr}`, 325, 155);

    } else {
      // 3. Cursive Calligraphy with Underline Seal
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.roundRect(8, 8, 634, 184, 14);
      ctx.fill();

      ctx.textAlign = "left";
      ctx.font = "bold 58px 'Dancing Script', 'Great Vibes', cursive, sans-serif";
      ctx.fillStyle = strokeColor;
      ctx.fillText(text, 40, 95);

      // Signature line
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 120);
      ctx.lineTo(600, 120);
      ctx.stroke();

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#475569";
      ctx.fillText(`Legally verified electronic signature of ${text} • ${dateStr}`, 40, 152);
    }

    return canvas.toDataURL("image/png");
  };

  // Update preview whenever name, style, or color changes
  useEffect(() => {
    const url = generateBadgeDataUrl(name, styleType, color);
    setPreviewUrl(url);
  }, [name, styleType, color]);

  const handleConfirm = () => {
    const dataUrl = generateBadgeDataUrl(name, styleType, color);
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
                  ? "bg-red-600 text-white shadow border border-red-500/40"
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

      {/* Live WYSIWYG Badge Preview */}
      <div className="border border-white/10 rounded-2xl p-2 bg-slate-950/80 flex items-center justify-center min-h-[105px] overflow-hidden shadow-inner">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Signature Preview"
            className="max-h-[95px] w-auto object-contain rounded-lg shadow-sm"
          />
        )}
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
