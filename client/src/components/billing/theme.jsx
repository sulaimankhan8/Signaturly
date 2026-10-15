/**
 * The values the billing pages are styled with: buttons, panels, inputs, the colour of each
 * metric, and the icons. Kept apart from the components (./ui.jsx) that use them.
 *
 * The look is the rest of the app's (the dashboard, the navbar): thick borders, hard offset
 * shadows, black-weight uppercase labels, and red, yellow, blue, green and purple as accents.
 */

// A button rises toward its shadow on hover and presses into it on click
const PRESS = "hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 motion-reduce:transform-none";
const BUTTON = "inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all text-center disabled:opacity-40 disabled:pointer-events-none";

export const BTN = {
  primary: `${BUTTON} ${PRESS} bg-red-600 hover:bg-red-500 text-white border-black shadow-[3px_3px_0px_0px_#facc15] hover:shadow-[4px_4px_0px_0px_#ffffff]`,
  secondary: `${BUTTON} ${PRESS} bg-[#1e2235] hover:bg-[#282d47] text-white border-white/20 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#ffffff]`,
  ghost: `${BUTTON} bg-transparent border-transparent hover:bg-white/10 text-gray-300 hover:text-white`,
  yellow: `${BUTTON} ${PRESS} bg-yellow-400 hover:bg-yellow-300 text-black border-black shadow-[3px_3px_0px_0px_#ef4444] hover:shadow-[4px_4px_0px_0px_#ef4444]`,
  violet: `${BUTTON} ${PRESS} bg-purple-600 hover:bg-purple-500 text-white border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#ffffff]`,
  blue: `${BUTTON} ${PRESS} bg-blue-600 hover:bg-blue-500 text-white border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#ffffff]`,
  small: "inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg border-2 border-white/20 bg-[#1e2235] hover:bg-[#282d47] text-white text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#ffffff] transition-all disabled:opacity-40 disabled:pointer-events-none",
};

export const PANEL = "bg-[#13151f] border-2 border-white/20 rounded-2xl shadow-[4px_4px_0px_0px_#000]";
export const INPUT = "w-full min-h-[44px] px-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white text-sm font-bold placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-colors disabled:opacity-60";
export const LABEL = "block text-[11px] font-black uppercase tracking-wider text-gray-300 mb-1.5";
export const FIGURE = "font-black text-white tracking-tight tabular-nums";
// The small uppercase line above a figure or a group
export const EYEBROW = "text-[11px] font-black uppercase tracking-wider text-gray-300";

// One metric's colour, as the dashboard's stat cards wear it: a hard shadow and a solid icon chip
export const ACCENTS = {
  green: { shadow: "shadow-[4px_4px_0px_0px_#22c55e]", chip: "bg-emerald-500 text-black", text: "text-emerald-400", link: "text-emerald-400 hover:text-emerald-300" },
  yellow: { shadow: "shadow-[4px_4px_0px_0px_#facc15]", chip: "bg-yellow-400 text-black", text: "text-yellow-400", link: "text-yellow-400 hover:text-yellow-300" },
  blue: { shadow: "shadow-[4px_4px_0px_0px_#3b82f6]", chip: "bg-blue-600 text-white", text: "text-blue-400", link: "text-blue-400 hover:text-blue-300" },
  purple: { shadow: "shadow-[4px_4px_0px_0px_#a855f7]", chip: "bg-purple-600 text-white", text: "text-purple-400", link: "text-purple-400 hover:text-purple-300" },
  red: { shadow: "shadow-[4px_4px_0px_0px_#ef4444]", chip: "bg-red-600 text-white", text: "text-red-400", link: "text-red-400 hover:text-red-300" },
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
  // The navbar's mark: a page with two lines on it
  brand: icon(<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />, 2.5),
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
  shieldCheck: icon(
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
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
  back: icon(<path d="M19 12H5M11 18l-6-6 6-6" />),
  copy: icon(
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  bolt: icon(<path d="M13 10V3L4 14h7v7l9-11h-7z" />, 2.5),
  receipt: icon(
    <>
      <path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z" />
      <path d="M8 9h8M8 13h8" />
    </>
  ),
  infinity: icon(<path d="M18.18 8.82a4.5 4.5 0 1 1 0 6.36L12 9l-6.18 6.18a4.5 4.5 0 1 1 0-6.36L12 15z" />),
};
