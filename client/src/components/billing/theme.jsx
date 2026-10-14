/**
 * The values the billing pages are styled with: buttons, panels, inputs, the tint of each
 * metric or plan, and the icons. Kept apart from the components (./ui.jsx) that use them.
 */

const BUTTON = "inline-flex items-center justify-center gap-2 min-h-[44px] px-[18px] rounded-[10px] text-sm font-bold transition-colors text-center disabled:opacity-40 disabled:pointer-events-none";

export const BTN = {
  primary: `${BUTTON} bg-rose-600 hover:bg-rose-500 text-white`,
  secondary: `${BUTTON} bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.14] text-gray-100`,
  ghost: `${BUTTON} bg-transparent hover:bg-white/[0.06] text-gray-300 hover:text-white`,
  violet: `${BUTTON} bg-violet-600 hover:bg-violet-500 text-white`,
  blue: `${BUTTON} bg-blue-600 hover:bg-blue-500 text-white`,
  small: "inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg text-[13px] font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none",
};

export const PANEL = "bg-[#12141c] border border-white/[0.08] rounded-2xl";
export const INPUT = "w-full min-h-[44px] px-3 bg-[#0d0e14] border border-white/[0.14] rounded-[10px] text-white text-sm placeholder-gray-500 focus:outline-none focus:border-rose-500";
export const LABEL = "block text-xs font-bold text-gray-400 mb-1.5";
export const FIGURE = "font-display font-bold text-white tracking-tight";

// The tinted panel of one metric or plan: its colour, softly, behind and around it
export const TINTS = {
  emerald: { panel: "bg-gradient-to-b from-emerald-400/10 to-emerald-400/[0.02] border border-emerald-400/25", text: "text-emerald-200", icon: "text-emerald-300", chip: "bg-emerald-400/[0.12] text-emerald-300" },
  amber: { panel: "bg-gradient-to-b from-amber-400/10 to-amber-400/[0.02] border border-amber-400/30", text: "text-amber-200", icon: "text-amber-300", chip: "bg-amber-400/[0.14] text-amber-300" },
  sky: { panel: "bg-gradient-to-b from-sky-400/10 to-sky-400/[0.02] border border-sky-400/25", text: "text-sky-200", icon: "text-sky-300", chip: "bg-sky-400/[0.13] text-sky-300" },
  violet: { panel: "bg-gradient-to-b from-violet-400/[0.11] to-violet-400/[0.02] border border-violet-400/25", text: "text-violet-200", icon: "text-violet-300", chip: "bg-violet-400/[0.14] text-violet-300" },
  rose: { panel: "bg-gradient-to-b from-rose-500/10 to-rose-500/[0.02] border border-rose-500/30", text: "text-rose-200", icon: "text-rose-300", chip: "bg-rose-500/[0.14] text-rose-300" },
  gray: { panel: "bg-[#12141c] border border-white/[0.08]", text: "text-gray-200", icon: "text-gray-300", chip: "bg-white/[0.07] text-gray-300" },
};

// ----- icons: stroke drawings that take the colour of the text around them -----

const icon =
  (paths, strokeWidth = 2) =>
  ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths}
    </svg>
  );

export const ICONS = {
  check: icon(<polyline points="20 6 9 17 4 12" />, 3),
  lock: icon(
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  doc: icon(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  plus: icon(<path d="M12 5v14M5 12h14" />),
  wallet: icon(
    <>
      <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15V7" />
      <path d="M16 14h.01" />
    </>
  ),
  trend: icon(
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  info: icon(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  alert: icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  clock: icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  users: icon(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  download: icon(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  phone: icon(
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </>
  ),
  card: icon(
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  shield: icon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  send: icon(
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  image: icon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  close: icon(<path d="M6 6l12 12M18 6L6 18" />),
  arrow: icon(<path d="M5 12h14M13 6l6 6-6 6" />),
  copy: icon(
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  bolt: icon(<path d="M13 10V3L4 14h7v7l9-11h-7z" />, 2.5),
};
