import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LIGHT, INKS } from "./signature/lightTheme";
import { trimmedDataUrl } from "./signature/canvasTools";

/**
 * Draw a signature with a finger, mouse or pen.
 *
 * Strokes are drawn as smooth curves whose width follows the pen: thinner when it moves fast,
 * thicker when slow or pressed hard, the way ink behaves. The image handed on is cropped to the
 * ink, so it fills the field it is placed in.
 */
export default function SignaturePad({ onConfirm }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const drawingRef = useRef(false);
  const [color, setColor] = useState(INKS[0].value);
  const [weight, setWeight] = useState(2.5);
  const [hasInk, setHasInk] = useState(false);

  const context = () => canvasRef.current?.getContext("2d");

  // Width of the line at a point, from how fast the pen moved to it and how hard it pressed
  const widthAt = (previous, point, base) => {
    const elapsed = Math.max(1, point.t - previous.t);
    const speed = Math.hypot(point.x - previous.x, point.y - previous.y) / elapsed;
    const pressure = point.pressure > 0 && point.pressure !== 0.5 ? point.pressure * 1.6 : 1;
    return Math.max(base * 0.45, Math.min(base * 1.7, (base * 1.5 - speed * base * 0.35) * pressure));
  };

  const drawSegment = (ctx, stroke, index) => {
    const point = stroke.points[index];
    const previous = stroke.points[index - 1];
    if (!previous) {
      ctx.beginPath();
      ctx.fillStyle = stroke.color;
      ctx.arc(point.x, point.y, stroke.weight * 0.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const before = stroke.points[index - 2] || previous;
    const start = { x: (before.x + previous.x) / 2, y: (before.y + previous.y) / 2 };
    const end = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };

    // Width eases toward the new value so the line does not jump
    point.width = previous.width ? previous.width * 0.6 + widthAt(previous, point, stroke.weight) * 0.4 : stroke.weight;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = point.width;
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(previous.x, previous.y, end.x, end.y);
    ctx.stroke();
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    for (const stroke of strokesRef.current) {
      for (const point of stroke.points) delete point.width;
      for (let i = 0; i < stroke.points.length; i++) drawSegment(ctx, stroke, i);
    }
  };

  // The canvas matches its size on screen and the screen's sharpness, and keeps what was drawn
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.offsetWidth * ratio);
      canvas.height = Math.round(canvas.offsetHeight * ratio);
      const ctx = context();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      redraw();
    };
    fit();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pointOf = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, t: event.timeStamp || Date.now(), pressure: event.pressure || 0 };
  };

  const down = (event) => {
    event.preventDefault();
    // Keeps the stroke going when a finger slides off the edge of the pad
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    const stroke = { color, weight, points: [pointOf(event)] };
    strokesRef.current.push(stroke);
    drawSegment(context(), stroke, 0);
    setHasInk(true);
  };

  const move = (event) => {
    if (!drawingRef.current) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    // Pens and fingers report extra points between frames; use them for a smoother line
    const events = event.nativeEvent.getCoalescedEvents?.() || [event.nativeEvent];
    const ctx = context();
    for (const sample of events) {
      stroke.points.push(pointOf(sample));
      drawSegment(ctx, stroke, stroke.points.length - 1);
    }
  };

  const up = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    strokesRef.current = [];
    redraw();
    setHasInk(false);
  };

  const undo = () => {
    strokesRef.current.pop();
    redraw();
    setHasInk(strokesRef.current.length > 0);
  };

  const confirm = () => {
    if (strokesRef.current.length === 0) {
      toast.error(t("pad.needDrawing"));
      return;
    }
    onConfirm(trimmedDataUrl(canvasRef.current));
    toast.success(t("pad.captured"));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
        <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-gray-700">
          {t("pad.stroke")}
          <input type="range" min="1.5" max="5" step="0.5" value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-24 accent-red-600" />
        </label>
      </div>

      <div className="relative h-44 sm:h-40 bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[3px_3px_0px_0px_#000]">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          aria-label={t("pad.hint")}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        {/* The line to sign on */}
        <span aria-hidden="true" className="absolute left-6 right-6 bottom-9 border-b-2 border-dashed border-gray-300 pointer-events-none" />
        {!hasInk && (
          <span className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold text-gray-400 pointer-events-none select-none">{t("pad.hint")}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={clear} className={LIGHT.quiet}>
          {t("pad.clear")}
        </button>
        <button type="button" onClick={undo} disabled={!hasInk} className={`${LIGHT.quiet} disabled:opacity-40`}>
          {t("pad.undo")}
        </button>
        <button type="button" onClick={confirm} className={`${LIGHT.primary} ml-auto`}>
          {t("pad.attach")}
        </button>
      </div>
    </div>
  );
}
