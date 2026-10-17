import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LIGHT, INKS } from "./signature/lightTheme";
import { ensureFont, fitFont, trimmedDataUrl } from "./signature/canvasTools";

// Typeface names are proper names and are shown as they are in every language
const CURSIVE_FONTS = [
  { name: "Great Vibes", weight: "400" },
  { name: "Dancing Script", weight: "700" },
  { name: "Caveat", weight: "700" },
  { name: "Alex Brush", weight: "400" },
];

const WIDTH = 900;
const HEIGHT = 240;

/**
 * Type a name and pick a handwriting typeface. Long names are made smaller to fit rather than
 * cut off, and the typeface is loaded before the signature is drawn so it never comes out in
 * a plain fallback.
 */
export default function TypeSignature({ onConfirm, defaultText = "" }) {
  const { t } = useTranslation();
  const [typedName, setTypedName] = useState(defaultText);
  const [font, setFont] = useState(CURSIVE_FONTS[0]);
  const [color, setColor] = useState(INKS[0].value);
  const [busy, setBusy] = useState(false);

  // Lazy-load handwriting fonts only when signature creation studio is open
  useEffect(() => {
    import("../styles/handwriting-fonts.css");
  }, []);

  const generate = async () => {
    const text = typedName.trim();
    if (!text) {
      toast.error(t("typed.needName"));
      return;
    }
    setBusy(true);
    try {
      await ensureFont(font.name, { weight: font.weight });
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext("2d");
      fitFont(ctx, text, (size) => `${font.weight} ${size}px "${font.name}", cursive`, 120, WIDTH - 60);
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, WIDTH / 2, HEIGHT / 2);
      onConfirm(trimmedDataUrl(canvas));
      toast.success(t("typed.generated"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={LIGHT.label} htmlFor="typed-name">
          {t("typed.label")}
        </label>
        <input
          id="typed-name"
          type="text"
          value={typedName}
          maxLength={80}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={t("typed.placeholder")}
          autoComplete="name"
          className={LIGHT.input}
        />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
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
              title={t(`pad.color.${ink.key}`)}
              aria-label={t(`pad.color.${ink.key}`)}
            />
          ))}
        </div>
      </div>

      {/* Each typeface, showing the name as it will look */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={t("typed.style")}>
        {CURSIVE_FONTS.map((option) => {
          const active = option.name === font.name;
          return (
            <button
              key={option.name}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.name}
              onClick={() => setFont(option)}
              className={`min-h-[64px] px-3 rounded-xl border-2 border-black bg-white flex items-center justify-center overflow-hidden transition-all ${
                active ? "ring-4 ring-yellow-300 shadow-[3px_3px_0px_0px_#000]" : "opacity-80 hover:opacity-100"
              }`}
            >
              <span
                className="truncate max-w-full leading-tight"
                style={{ fontFamily: `"${option.name}", cursive`, fontWeight: option.weight, color, fontSize: typedName.length > 22 ? 22 : 30 }}
              >
                {typedName.trim() || t("typed.preview")}
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={generate} disabled={!typedName.trim() || busy} className={`${LIGHT.primary} w-full`}>
        {t("typed.use")}
      </button>
    </div>
  );
}
