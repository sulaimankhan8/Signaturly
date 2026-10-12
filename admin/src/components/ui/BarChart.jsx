import { useEffect, useRef, useState } from "react";
import { Button } from "./basics.jsx";
import { count } from "../../lib/format.js";

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 48 };
const BAR = "#3987e5";
const BAR_ACTIVE = "#6da7ec";

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

// A bar with its top corners barely eased and a square foot on the baseline
const barPath = (x, y, width, height) => {
  const r = Math.min(1.5, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
};

/**
 * Daily figures as bars: one bar a day, nothing drawn between days that did not happen.
 *
 * data: [{ key, label, value }], oldest first. `format` writes a value in full.
 * Every value can be read without a mouse: the arrow keys move from day to day when the
 * chart has focus, and "Show as table" lists them all.
 */
export default function BarChart({ data, label, format = count }) {
  const box = useRef(null);
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
  const slot = plotWidth / Math.max(1, data.length);
  // Never the full slot: the space left over is what separates one day from the next
  const barWidth = Math.max(2, Math.min(24, slot - 2));
  const yOf = (value) => PAD.top + plotHeight - (value / top) * plotHeight;
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];
  const labelled = new Set(spread(data.length, Math.min(7, Math.max(2, Math.floor(plotWidth / 64)))));
  const current = active !== null ? data[active] : null;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const onKeyDown = (event) => {
    const last = data.length - 1;
    const move = { ArrowLeft: Math.max(0, (active ?? last + 1) - 1), ArrowRight: Math.min(last, (active ?? -1) + 1), Home: 0, End: last }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    setActive(move);
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="quiet" onClick={() => setAsTable((on) => !on)} aria-pressed={asTable}>
          {asTable ? "Show as chart" : "Show as table"}
        </Button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border-2 border-edge">
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
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={yOf(tick)} y2={yOf(tick)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <text x={PAD.left - 8} y={yOf(tick) + 4} textAnchor="end" fontSize="12" fill="#8a91a3" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {tick >= 1000 ? compact.format(tick) : count(tick)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const x = PAD.left + i * slot + (slot - barWidth) / 2;
              const height = d.value > 0 ? Math.max(2, PAD.top + plotHeight - yOf(d.value)) : 0;
              return (
                <g key={d.key}>
                  {height > 0 && <path d={barPath(x, PAD.top + plotHeight - height, barWidth, height)} fill={i === active ? BAR_ACTIVE : BAR} />}
                  {labelled.has(i) && (
                    <text
                      x={i === data.length - 1 ? width - PAD.right : i === 0 ? PAD.left : PAD.left + i * slot + slot / 2}
                      y={HEIGHT - 8}
                      textAnchor={i === data.length - 1 ? "end" : i === 0 ? "start" : "middle"}
                      fontSize="12"
                      fill="#8a91a3"
                    >
                      {d.label}
                    </text>
                  )}
                  {/* The whole column answers the pointer, not only the painted bar */}
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotHeight} fill="transparent" onPointerMove={() => setActive(i)} />
                </g>
              );
            })}
          </svg>

          {current && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-full rounded-lg border-2 border-edge bg-surface-raised px-3 py-1.5 text-center shadow-hard-sm whitespace-nowrap"
              style={{
                left: Math.min(width - 60, Math.max(60, PAD.left + active * slot + slot / 2)),
                top: Math.max(44, yOf(current.value) - 8),
              }}
            >
              <div className="text-sm font-bold text-ink tabular-nums">{format(current.value)}</div>
              <div className="text-xs text-ink-muted">{current.label}</div>
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
