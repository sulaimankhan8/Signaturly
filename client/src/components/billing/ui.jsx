import { ICONS } from "./theme";

/**
 * The parts the billing pages are built from, in the app's neo-brutalist look: solid badges
 * with black borders, notes with a solid icon chip, choices that lift onto a yellow shadow when
 * picked. Kept in one place so the overview, plans, checkout and the payment screens look like
 * one thing, and like the dashboard.
 */

// The small solid label that says how something stands, like the dashboard's status badges
const PILL_TONES = {
  green: "bg-emerald-500 text-black border-black",
  yellow: "bg-yellow-400 text-black border-black",
  red: "bg-red-600 text-white border-black",
  blue: "bg-blue-600 text-white border-black",
  gray: "bg-[#1e2235] text-gray-200 border-white/20",
  violet: "bg-purple-600 text-white border-black",
};

export const Pill = ({ tone = "gray", dot = false, children, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border-2 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-[2px_2px_0px_0px_#000] ${PILL_TONES[tone] || PILL_TONES.gray} ${className}`}>
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
    {children}
  </span>
);

// "2 months free": the saving, as the plans show it
export const SaveBadge = ({ children }) => (
  <span className="px-2 py-0.5 rounded-md border-2 border-black bg-yellow-400 text-black text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-[2px_2px_0px_0px_#000]">{children}</span>
);

// A note in a coloured box: what is about to happen, or what went wrong
const NOTE_TONES = {
  blue: ["bg-blue-500/[0.08] border-blue-500/60 text-blue-50", "bg-blue-600 text-white"],
  amber: ["bg-yellow-400/[0.07] border-yellow-400/60 text-yellow-50", "bg-yellow-400 text-black"],
  red: ["bg-red-600/10 border-red-500/70 text-red-50", "bg-red-600 text-white"],
  violet: ["bg-purple-500/[0.08] border-purple-500/60 text-purple-50", "bg-purple-600 text-white"],
  green: ["bg-emerald-500/[0.08] border-emerald-500/60 text-emerald-50", "bg-emerald-500 text-black"],
  gray: ["bg-[#0f1118] border-white/20 text-gray-200", "bg-[#1e2235] text-gray-200"],
};
export const Note = ({ tone = "blue", icon = "info", role = "note", children, className = "", testId }) => {
  const Glyph = ICONS[icon] || ICONS.info;
  const [box, chip] = NOTE_TONES[tone] || NOTE_TONES.blue;
  return (
    <div role={role} data-testid={testId} className={`flex gap-3 px-4 py-3 rounded-xl border-2 text-sm leading-relaxed ${box} ${className}`}>
      <span className={`w-7 h-7 shrink-0 grid place-items-center rounded-lg border-2 border-black ${chip}`} aria-hidden="true">
        <Glyph className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1 self-center">{children}</div>
    </div>
  );
};

// A choice drawn as a card, with a real radio button inside it. The one picked lifts onto a yellow shadow.
export const ChoiceCard = ({ name, checked, onChange, disabled = false, title, badge, price, children }) => (
  <label
    className={`flex gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${checked ? "border-yellow-400 bg-yellow-400/[0.06] shadow-[3px_3px_0px_0px_#facc15]" : "border-white/15 bg-[#0f1118] hover:border-white/35"} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
  >
    <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="mt-0.5 w-[18px] h-[18px] shrink-0 accent-yellow-400" />
    <span className="flex-1 min-w-0">
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2 font-black text-white">
          {title}
          {badge}
        </span>
        {price && <span className="font-black text-white whitespace-nowrap tabular-nums">{price}</span>}
      </span>
      {children && <span className="block mt-1 text-[13px] text-gray-400 leading-relaxed">{children}</span>}
    </span>
  </label>
);

// One more, one fewer: for seats and packs
const STEP = "w-11 h-11 grid place-items-center rounded-xl border-2 border-white/20 bg-[#1e2235] hover:bg-[#282d47] text-white text-lg font-black shadow-[2px_2px_0px_0px_#000] active:translate-x-px active:translate-y-px active:shadow-none transition-all disabled:opacity-30 disabled:shadow-none";
export const Stepper = ({ value, onLess, onMore, lessDisabled, moreDisabled, lessLabel, moreLabel, children }) => (
  <div className="inline-flex items-center gap-2" role="group">
    <button type="button" onClick={onLess} disabled={lessDisabled} aria-label={lessLabel} className={STEP}>
      −
    </button>
    {children || (
      <span className="min-w-[2.25rem] text-center text-xl font-black text-white tabular-nums" aria-live="polite">
        {value}
      </span>
    )}
    <button type="button" onClick={onMore} disabled={moreDisabled} aria-label={moreLabel} className={STEP}>
      +
    </button>
  </div>
);

export const Spinner = ({ className = "w-5 h-5", colour = "#facc15" }) => (
  <svg className={`${className} animate-spin shrink-0`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke={colour} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// What every payment comes with, said where a customer decides to pay
const ASSURANCES = ["Prices include GST", "GST invoice for every payment", "Cancel auto-renew any time", "Paid through Razorpay"];

export const Assurances = ({ items = ASSURANCES, className = "" }) => (
  <ul className={`flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-gray-300 ${className}`}>
    {items.map((fact) => (
      <li key={fact} className="inline-flex items-center gap-1.5">
        <span className="w-4 h-4 grid place-items-center rounded bg-emerald-500 text-black border border-black" aria-hidden="true">
          <ICONS.check className="w-2.5 h-2.5" />
        </span>
        {fact}
      </li>
    ))}
  </ul>
);

// How the money is taken, as small tags: the reassurance that the usual ways all work. Auto-renew
// is a standing mandate, which Razorpay takes by UPI Autopay, card or bank e-mandate; netbanking
// is for one payment only.
export const PayMethods = ({ recurring = false, className = "" }) => (
  <ul aria-label="Ways to pay" className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
    {(recurring ? ["UPI Autopay", "Cards", "Bank e-mandate"] : ["UPI", "Cards", "Netbanking"]).map((way) => (
      <li key={way} className="px-2 py-0.5 rounded-md border-2 border-white/15 bg-[#0f1118] text-[10px] font-black uppercase tracking-wider text-gray-300">
        {way}
      </li>
    ))}
  </ul>
);
