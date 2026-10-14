import { ICONS } from "./theme";

/**
 * The parts the billing pages are built from: soft panels, one colour per plan or metric,
 * Space Grotesk for figures. Kept in one place so the overview, plans, checkout and the
 * payment screens look like one thing.
 */

// The small label that says how something stands
const PILL_TONES = {
  green: "bg-emerald-400/[0.12] text-emerald-300",
  yellow: "bg-amber-400/[0.14] text-amber-300",
  red: "bg-rose-500/[0.15] text-rose-300",
  blue: "bg-sky-400/[0.13] text-sky-300",
  gray: "bg-white/[0.07] text-gray-300",
  violet: "bg-violet-400/[0.14] text-violet-300",
};
const DOTS = { green: "bg-emerald-400", yellow: "bg-amber-400", red: "bg-rose-400", blue: "bg-sky-400", gray: "bg-gray-400", violet: "bg-violet-400" };

export const Pill = ({ tone = "gray", dot = false, children, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${PILL_TONES[tone] || PILL_TONES.gray} ${className}`}>
    {dot && <span className={`w-[7px] h-[7px] rounded-full ${DOTS[tone] || DOTS.gray}`} aria-hidden="true" />}
    {children}
  </span>
);

// "2 months free": the saving, as the plans show it
export const SaveBadge = ({ children }) => <span className="px-2 py-0.5 rounded-md bg-amber-400 text-[#1a1405] text-[11px] font-bold whitespace-nowrap">{children}</span>;

// A note in a coloured box: what is about to happen, or what went wrong
const NOTE_TONES = {
  blue: "bg-sky-400/[0.08] border-sky-400/30 text-sky-100",
  amber: "bg-amber-400/[0.08] border-amber-400/30 text-amber-100",
  red: "bg-rose-500/[0.08] border-rose-500/35 text-rose-100",
  violet: "bg-violet-400/[0.08] border-violet-400/30 text-violet-100",
  gray: "bg-white/[0.04] border-white/10 text-gray-200",
};
export const Note = ({ tone = "blue", icon = "info", role = "note", children, className = "", testId }) => {
  const Glyph = ICONS[icon] || ICONS.info;
  return (
    <div role={role} data-testid={testId} className={`flex gap-3 px-4 py-3.5 rounded-xl border text-sm leading-relaxed ${NOTE_TONES[tone] || NOTE_TONES.blue} ${className}`}>
      <Glyph className="w-[18px] h-[18px] shrink-0 mt-0.5 opacity-80" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

// A choice drawn as a card, with a real radio button inside it
export const ChoiceCard = ({ name, checked, onChange, disabled = false, title, badge, price, children }) => (
  <label
    className={`flex gap-3 p-4 rounded-xl border-[1.5px] cursor-pointer transition-colors ${checked ? "border-violet-400 bg-violet-500/10" : "border-white/[0.12] bg-[#0f1118] hover:border-white/25"} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
  >
    <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="mt-1 w-[18px] h-[18px] shrink-0 accent-violet-400" />
    <span className="flex-1 min-w-0">
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2 font-bold text-white">
          {title}
          {badge}
        </span>
        {price && <span className="font-display font-bold text-white whitespace-nowrap">{price}</span>}
      </span>
      {children && <span className="block mt-1 text-sm text-gray-400 leading-relaxed">{children}</span>}
    </span>
  </label>
);

// One more, one fewer: for seats and packs
export const Stepper = ({ value, onLess, onMore, lessDisabled, moreDisabled, lessLabel, moreLabel, children }) => (
  <div className="inline-flex items-center gap-2" role="group">
    <button type="button" onClick={onLess} disabled={lessDisabled} aria-label={lessLabel} className="w-11 h-11 grid place-items-center rounded-[10px] border border-white/[0.16] bg-white/5 hover:bg-white/10 text-white text-lg font-bold disabled:opacity-30">
      −
    </button>
    {children || (
      <span className="min-w-[2rem] text-center font-display text-lg font-bold text-white tabular-nums" aria-live="polite">
        {value}
      </span>
    )}
    <button type="button" onClick={onMore} disabled={moreDisabled} aria-label={moreLabel} className="w-11 h-11 grid place-items-center rounded-[10px] border border-white/[0.16] bg-white/5 hover:bg-white/10 text-white text-lg font-bold disabled:opacity-30">
      +
    </button>
  </div>
);

export const Spinner = ({ className = "w-5 h-5", colour = "#a78bfa" }) => (
  <svg className={`${className} animate-spin shrink-0`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke={colour} strokeWidth="3" strokeLinecap="round" />
  </svg>
);
