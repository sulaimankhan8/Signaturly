import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LIGHT, INKS } from "./signature/lightTheme";
import { ensureFont, fitFont, initialsOf, trimmedDataUrl } from "./signature/canvasTools";

const SIZE = 240;
const SCRIPT = "Dancing Script";

/** Initials, typed as a monogram or drawn by hand */
export default function InitialsStudio({ onConfirm, defaultName = "" }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("type"); // type | draw
  const [initialsText, setInitialsText] = useState(initialsOf(defaultName));
  const [badgeStyle, setBadgeStyle] = useState("monogram-circle"); // monogram-circle | monogram-square | handwritten
  const [color, setColor] = useState(INKS[0].value);

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const strokesRef = useRef([]);
  const [hasInk, setHasInk] = useState(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    for (const stroke of strokesRef.current) {
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 3.5;
      stroke.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (mode !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.offsetWidth * ratio);
    canvas.height = Math.round(canvas.offsetHeight * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    redraw();
  }, [mode]);

  const pointOf = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const generateInitialsImage = async () => {
    const text = initialsText.trim().toUpperCase();
    if (badgeStyle !== "monogram-square") await ensureFont(SCRIPT, { weight: "700" });

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (badgeStyle === "monogram-circle") {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(120, 120, 105, 0, Math.PI * 2);
      ctx.stroke();
      fitFont(ctx, text, (size) => `700 ${size}px "${SCRIPT}", cursive`, 90, 160);
    } else if (badgeStyle === "monogram-square") {
      ctx.fillStyle = "rgba(241, 245, 249, 0.9)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(15, 15, 210, 210, 24);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      fitFont(ctx, text, (size) => `bold ${size}px sans-serif`, 80, 170);
    } else {
      fitFont(ctx, text, (size) => `700 ${size}px "${SCRIPT}", cursive`, 110, 220);
    }
    ctx.fillText(text, 120, 124);
    return canvas.toDataURL("image/png");
  };

  const handleConfirm = async () => {
    if (mode === "draw") {
      if (strokesRef.current.length === 0) {
        toast.error(t("initials.needDrawing"));
        return;
      }
      onConfirm(trimmedDataUrl(canvasRef.current));
      toast.success(t("initials.drawn"));
      return;
    }
    if (!initialsText.trim()) {
      toast.error(t("initials.needDrawing"));
      return;
    }
    onConfirm(await generateInitialsImage());
    toast.success(t("initials.generated"));
  };

  return (
    <div className="space-y-3">
      <div className={LIGHT.tabs} role="tablist">
        {["type", "draw"].map((id) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={LIGHT.tab(mode === id)}>
            {t(id === "type" ? "initials.modeType" : "initials.modeDraw")}
          </button>
        ))}
      </div>

      {mode === "type" ? (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={LIGHT.label} htmlFor="initials-text">
                {t("initials.label")}
              </label>
              <input
                id="initials-text"
                type="text"
                maxLength={4}
                value={initialsText}
                onChange={(e) => setInitialsText(e.target.value.toUpperCase())}
                className={`${LIGHT.input} text-center font-mono tracking-widest`}
              />
            </div>
            <div className="flex items-center gap-2 pb-0.5" role="radiogroup" aria-label={t("pad.ink")}>
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

          <div className={LIGHT.tabs} role="radiogroup" aria-label={t("typed.style")}>
            {[
              { id: "monogram-circle", labelKey: "initials.styleCircle" },
              { id: "monogram-square", labelKey: "initials.styleSquare" },
              { id: "handwritten", labelKey: "initials.styleCursive" },
            ].map((b) => (
              <button key={b.id} type="button" role="radio" aria-checked={badgeStyle === b.id} onClick={() => setBadgeStyle(b.id)} className={LIGHT.tab(badgeStyle === b.id)}>
                {t(b.labelKey)}
              </button>
            ))}
          </div>

          <div className="border-2 border-black rounded-2xl p-4 bg-white flex items-center justify-center min-h-[110px]">
            <div
              className={`w-20 h-20 flex items-center justify-center ${
                badgeStyle === "monogram-circle" ? "rounded-full border-2" : badgeStyle === "monogram-square" ? "rounded-xl border-2 bg-slate-50" : ""
              }`}
              style={{ borderColor: color }}
            >
              <span
                style={{
                  fontFamily: badgeStyle === "monogram-square" ? "sans-serif" : `"${SCRIPT}", cursive`,
                  color,
                  fontSize: badgeStyle === "monogram-square" ? 28 : 34,
                  fontWeight: "bold",
                }}
              >
                {initialsText}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="border-2 border-black rounded-2xl h-40 bg-white relative overflow-hidden shadow-[3px_3px_0px_0px_#000]">
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none cursor-crosshair"
              aria-label={t("pad.hint")}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                drawingRef.current = true;
                strokesRef.current.push({ color, points: [pointOf(e)] });
                setHasInk(true);
              }}
              onPointerMove={(e) => {
                if (!drawingRef.current) return;
                strokesRef.current[strokesRef.current.length - 1].points.push(pointOf(e));
                redraw();
              }}
              onPointerUp={() => (drawingRef.current = false)}
              onPointerCancel={() => (drawingRef.current = false)}
            />
          </div>
          <button
            type="button"
            disabled={!hasInk}
            onClick={() => {
              strokesRef.current = [];
              setHasInk(false);
              redraw();
            }}
            className={`${LIGHT.quiet} disabled:opacity-40`}
          >
            {t("initials.clearPad")}
          </button>
        </div>
      )}

      <button type="button" onClick={handleConfirm} className={`${LIGHT.primary} w-full`}>
        {t("initials.adopt")}
      </button>
    </div>
  );
}
