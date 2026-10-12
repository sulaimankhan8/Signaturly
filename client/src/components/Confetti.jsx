import { useEffect, useRef } from "react";

const COLOURS = ["#ef4444", "#facc15", "#ffffff", "#34d399", "#a855f7", "#38bdf8"];
const PIECES = 160;
const LASTS_MS = 4200;

/**
 * A burst of paper squares over the whole screen, once, for a moment worth marking.
 * It is drawn on a canvas that lets every click through, and is not shown at all to someone
 * who has asked their device for less motion.
 */
export default function Confetti() {
  const canvas = useRef(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const ctx = el.getContext("2d");
    const size = () => {
      el.width = window.innerWidth;
      el.height = window.innerHeight;
    };
    size();
    window.addEventListener("resize", size);

    // Thrown up and outwards from two points near the top corners of the card
    const pieces = Array.from({ length: PIECES }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 1.1;
      const speed = 7 + Math.random() * 9;
      return {
        x: el.width * (fromLeft ? 0.3 : 0.7),
        y: el.height * 0.45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        side: 6 + Math.random() * 8,
        turn: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.35,
        colour: COLOURS[i % COLOURS.length],
      };
    });

    const started = performance.now();
    let frame;
    const draw = (now) => {
      const age = now - started;
      ctx.clearRect(0, 0, el.width, el.height);
      // Fades out over the last second
      ctx.globalAlpha = Math.max(0, Math.min(1, (LASTS_MS - age) / 1000));
      for (const piece of pieces) {
        piece.vy += 0.28;
        piece.vx *= 0.99;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.turn += piece.spin;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.turn);
        ctx.fillStyle = piece.colour;
        ctx.fillRect(-piece.side / 2, -piece.side / 2, piece.side, piece.side * 0.6);
        ctx.restore();
      }
      if (age < LASTS_MS) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, el.width, el.height);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, []);

  return <canvas ref={canvas} className="fixed inset-0 z-40 pointer-events-none" aria-hidden="true" data-testid="confetti" />;
}
