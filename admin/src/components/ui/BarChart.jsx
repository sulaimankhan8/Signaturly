import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./basics.jsx";
import { count } from "../../lib/format.js";

const PAD = { top: 16, right: 12, bottom: 30, left: 52 };
const GRID = "rgba(255,255,255,0.06)";
const AXIS_TEXT = "#8a91a3";
const SURFACE = "#11141c";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

// The top of the scale: four equal steps of a round size, the smallest that holds the data
// eslint-disable-next-line react-refresh/only-export-components
export const scaleTop = (max) => {
  if (max <= 4) return 4;
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
  return step * 4;
};

// At most `limit` positions, evenly spread, always with the first and the last
const spread = (length, limit) => {
  if (length <= limit) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: limit }, (_, i) => Math.round((i * (length - 1)) / (limit - 1)));
};

// A bar with a 4px rounded top and a square foot on the baseline
const barPath = (x, y, width, height) => {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
};

/**
 * A smooth line through the points that never swings past them (monotone cubic), so a day
 * with nothing never dips below the baseline.
 */
const smoothPath = (points) => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  const n = points.length;
  const slopes = [];
  for (let i = 0; i < n - 1; i += 1) slopes.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]));
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  });
  for (let i = 0; i < n - 1; i += 1) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      tangents[i] = (3 * a * slopes[i]) / h;
      tangents[i + 1] = (3 * b * slopes[i]) / h;
    }
  }
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = (x1 - x0) / 3;
    d += ` C${x0 + dx},${y0 + tangents[i] * dx} ${x1 - dx},${y1 - tangents[i + 1] * dx} ${x1},${y1}`;
  }
  return d;
};

/**
 * Daily figures, one series, as bars (`variant="bar"`) or as a filled line (`"area"`).
 *
 * data: [{ key, label, value }], oldest first. `format` writes a value in full; `color` is
 * the series' one colour. Every value can be read without a mouse: the arrow keys move from
 * day to day when the chart has focus, and "Show as table" lists them all.
 */
export default function BarChart({ data, label, format = count, variant = "bar", color = "#3987e5", height: HEIGHT = 240 }) {
  const box = useRef(null);
  const gradientId = useId();
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    if (!box.current || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [asTable]);

  const top = scaleTop(Math.max(0, ...data.map((d) => d.value)));
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const base = PAD.top + plotHeight;
  const slot = plotWidth / Math.max(1, data.length);
  // Never the full slot: the space left over is what separates one day from the next
  const barWidth = Math.max(2, Math.min(24, slot - 3));
  const yOf = (value) => base - (value / top) * plotHeight;
  const xOf = (i) => PAD.left + i * slot + slot / 2;
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];
  const labelled = new Set(spread(data.length, Math.min(7, Math.max(2, Math.floor(plotWidth / 72)))));
  const current = active !== null ? data[active] : null;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const points = data.map((d, i) => [xOf(i), yOf(d.value)]);
  const line = variant === "area" ? smoothPath(points) : "";
  const area = line && points.length > 1 ? `${line} L${points[points.length - 1][0]},${base} L${points[0][0]},${base} Z` : "";

  const onKeyDown = (event) => {
    const last = data.length - 1;
    const move = { ArrowLeft: Math.max(0, (active ?? last + 1) - 1), ArrowRight: Math.min(last, (active ?? -1) + 1), Home: 0, End: last }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    setActive(move);
  };

  return (
    <div>
      <div className="flex justify-end -mt-1 mb-1">
        <Button size="sm" variant="quiet" onClick={() => setAsTable((on) => !on)} aria-pressed={asTable}>
          {asTable ? "Show as chart" : "Show as table"}
        </Button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-edge">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-card">
              <tr className="thead-row">
                <th scope="col" className="px-4 py-2 text-left">Day</th>
                <th scope="col" className="px-4 py-2 text-right">{label}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((d) => (
                <tr key={d.key}>
                  <td className="px-4 py-2 text-ink-muted">{d.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={box}
          className="relative rounded-lg"
          role="group"
          tabIndex={0}
          aria-label={`${label}, by day: ${format(total)} in all. Use the left and right arrow keys to read each day.`}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
        >
          <svg width={width} height={HEIGHT} className="block" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={yOf(tick)} y2={yOf(tick)} stroke={GRID} strokeWidth="1" />
                <text x={PAD.left - 10} y={yOf(tick) + 4} textAnchor="end" fontSize="12" fill={AXIS_TEXT} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {tick >= 1000 ? compact.format(tick) : count(tick)}
                </text>
              </g>
            ))}

            {variant === "area" && current && <line x1={xOf(active)} x2={xOf(active)} y1={PAD.top} y2={base} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />}
            {area && <path d={area} fill={`url(#${gradientId})`} />}
            {line && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}

            {data.map((d, i) => {
              const x = PAD.left + i * slot + (slot - barWidth) / 2;
              const barHeight = d.value > 0 ? Math.max(2, base - yOf(d.value)) : 0;
              const dimmed = active !== null && i !== active;
              return (
                <g key={d.key}>
                  {variant === "bar" && barHeight > 0 && <path d={barPath(x, base - barHeight, barWidth, barHeight)} fill={color} opacity={dimmed ? 0.45 : 1} />}
                  {labelled.has(i) && (
                    <text x={i === data.length - 1 ? width - PAD.right : i === 0 ? PAD.left : xOf(i)} y={HEIGHT - 8} textAnchor={i === data.length - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize="12" fill={AXIS_TEXT}>
                      {d.label}
                    </text>
                  )}
                  {/* The whole column answers the pointer, not only the painted mark */}
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotHeight} fill="transparent" onPointerMove={() => setActive(i)} />
                </g>
              );
            })}

            {variant === "area" && current && <circle cx={xOf(active)} cy={yOf(current.value)} r="5" fill={color} stroke={SURFACE} strokeWidth="2" pointerEvents="none" />}
          </svg>

          {current && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-surface-raised/95 backdrop-blur px-3 py-2 shadow-soft-lg whitespace-nowrap"
              style={{
                left: Math.min(width - 70, Math.max(70, xOf(active))),
                top: Math.max(52, yOf(current.value) - 12),
              }}
            >
              <div className="text-[11px] text-ink-faint">{current.label}</div>
              <div className="flex items-center gap-2 text-sm font-bold text-ink tabular-nums">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden="true" />
                {format(current.value)}
              </div>
            </div>
          )}

          <span className="sr-only" aria-live="polite">
            {current ? `${current.label}: ${format(current.value)}` : ""}
          </span>
          {total === 0 && <p className="absolute inset-x-0 top-1/3 text-center text-sm text-ink-muted pointer-events-none">Nothing in this period.</p>}
        </div>
      )}
    </div>
  );
}
