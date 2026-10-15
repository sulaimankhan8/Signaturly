/**
 * The light version of the app's look, for what signers see: the signing page and the signature
 * dialog. Signing pages are light and neutral so the document is the main thing on screen,
 * and the sender's colour can lead; the thick borders and hard shadows are the app's own.
 */

const PRESS = "hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 motion-reduce:transform-none";
const BUTTON =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border-2 border-black text-xs font-black uppercase tracking-wider transition-all text-center disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300";

export const LIGHT = {
  page: "bg-[#f3efe6] text-gray-900",
  panel: "bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]",
  input:
    "w-full min-h-[44px] px-3 bg-white border-2 border-black rounded-xl text-gray-900 text-base sm:text-sm font-bold placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-300",
  label: "block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1.5",
  primary: `${BUTTON} ${PRESS} bg-red-600 hover:bg-red-500 text-white shadow-[3px_3px_0px_0px_#000]`,
  secondary: `${BUTTON} ${PRESS} bg-white hover:bg-yellow-100 text-black shadow-[2px_2px_0px_0px_#000]`,
  success: `${BUTTON} ${PRESS} bg-emerald-500 hover:bg-emerald-400 text-black shadow-[3px_3px_0px_0px_#000]`,
  quiet: "inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-lg text-xs font-black uppercase tracking-wider text-gray-700 hover:bg-black/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300",
  tabs: "flex gap-1 p-1 bg-[#f3efe6] border-2 border-black rounded-xl",
  tab: (active) =>
    `flex-1 min-h-[40px] px-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 ${
      active ? "bg-yellow-300 border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black" : "border-2 border-transparent text-gray-600 hover:text-black"
    }`,
  swatch: (active) => `w-9 h-9 sm:w-8 sm:h-8 rounded-lg border-2 border-black transition-all ${active ? "ring-4 ring-yellow-300 scale-105" : "opacity-80 hover:opacity-100"}`,
};

// Ink colours a signer can choose; blue is usual for signatures in India
export const INKS = [
  { key: "black", value: "#111111" },
  { key: "blue", value: "#1d3fae" },
  { key: "red", value: "#a11b1b" },
];
