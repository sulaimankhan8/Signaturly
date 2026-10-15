import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LIGHT, INKS } from "./signature/lightTheme";
import { ensureFont, fitFont } from "./signature/canvasTools";

const WIDTH = 650;
const HEIGHT = 200;
const FONT = "Dancing Script";

/**
 * A signature drawn as a stamp: the signer's name in a script typeface inside a frame.
 *
 * The stamp carries no date. A signature can be reused, and a date drawn into it would go
 * stale; when the document was signed is written in its date fields and its signing record,
 * by the server's clock.
 */
export default function VerifiedESignBadge({ onConfirm, defaultName = "" }) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName || "");
  const [styleType, setStyleType] = useState("modern-badge"); // modern-badge | formal-stamp | cursive-badge
  const [color, setColor] = useState(INKS[0].value);
  const [previewUrl, setPreviewUrl] = useState("");

  const draw = async (signerName = name, style = styleType, ink = color) => {
    const text = signerName.trim();
    if (!text) return "";
    await ensureFont(FONT, { weight: "700" });

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    const script = (size) => `700 ${size}px "${FONT}", cursive`;

    if (style === "modern-badge") {
      ctx.fillStyle = "rgba(248, 250, 252, 0.98)";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(10, 10, 630, 180, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.roundRect(10, 10, 14, 180, [16, 0, 0, 16]);
      ctx.fill();

      ctx.font = "bold 15px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText("ELECTRONICALLY SIGNED", 40, 42);

      fitFont(ctx, text, script, 56, 580);
      ctx.fillStyle = ink;
      ctx.fillText(text, 40, 112);

      ctx.font = "13px monospace";
      ctx.fillStyle = "#475569";
      ctx.fillText("Electronic signature", 40, 160);
    } else if (style === "formal-stamp") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.roundRect(8, 8, 634, 184, 14);
      ctx.fill();

      ctx.strokeStyle = ink;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(12, 12, 626, 176, 12);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(18, 18, 614, 164, 8);
      ctx.stroke();

      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.fillText("ELECTRONICALLY SIGNED", 325, 50);

      fitFont(ctx, text, script, 52, 560);
      ctx.fillText(text, 325, 116);

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#475569";
      ctx.fillText("Electronic signature", 325, 160);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.roundRect(8, 8, 634, 184, 14);
      ctx.fill();

      ctx.textAlign = "left";
      fitFont(ctx, text, script, 62, 560);
      ctx.fillStyle = ink;
      ctx.fillText(text, 40, 98);

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 124);
      ctx.lineTo(600, 124);
      ctx.stroke();

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#475569";
      const footer = `Electronic signature of ${text}`;
      fitFont(ctx, footer, (size) => `bold ${size}px sans-serif`, 13, 560, 9);
      ctx.fillText(footer, 40, 156);
    }

    return canvas.toDataURL("image/png");
  };

  useEffect(() => {
    let current = true;
    draw(name, styleType, color).then((url) => current && setPreviewUrl(url));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, styleType, color]);

  const handleConfirm = async () => {
    const dataUrl = await draw(name, styleType, color);
    if (!dataUrl) {
      toast.error(t("typed.needName"));
      return;
    }
    onConfirm(dataUrl);
    toast.success(t("stamp.applied"));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={LIGHT.label} htmlFor="stamp-name">
          {t("stamp.nameLabel")}
        </label>
        <input
          id="stamp-name"
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("stamp.namePlaceholder")}
          className={LIGHT.input}
        />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className={`${LIGHT.tabs} flex-1 min-w-[220px]`} role="radiogroup" aria-label={t("typed.style")}>
          {[
            { id: "modern-badge", labelKey: "stamp.styleCard" },
            { id: "formal-stamp", labelKey: "stamp.styleStamp" },
            { id: "cursive-badge", labelKey: "stamp.styleLine" },
          ].map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={styleType === s.id} onClick={() => setStyleType(s.id)} className={LIGHT.tab(styleType === s.id)}>
              {t(s.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2" role="radiogroup" aria-label={t("pad.ink")}>
          {INKS.map((ink) => (
            <button
              key={ink.value}
              type="button"
              role="radio"
              aria-checked={color === ink.value}
              onClick={() => setColor(ink.value)}
              className={LIGHT.swatch(color === ink.value)}
              style={{ background: ink.value }}
              aria-label={t(`pad.color.${ink.key}`)}
            />
          ))}
        </div>
      </div>

      <div className="border-2 border-black rounded-2xl p-2 bg-[#f3efe6] flex items-center justify-center min-h-[110px] overflow-hidden">
        {previewUrl ? <img src={previewUrl} alt={t("stamp.previewAlt")} className="max-h-[100px] w-auto object-contain" /> : <span className="text-xs text-gray-500">{t("typed.preview")}</span>}
      </div>

      <button type="button" onClick={handleConfirm} disabled={!name.trim()} className={`${LIGHT.primary} w-full`}>
        {t("stamp.adopt")}
      </button>
    </div>
  );
}
