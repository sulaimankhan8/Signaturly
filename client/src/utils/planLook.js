/**
 * How each plan looks wherever it is shown: the tag above its name, its colour, its card, the
 * button beneath it, and its panel at checkout. Plans are told apart by family (pro_monthly
 * and pro_annual are both "pro"); a plan the list does not know gets the plain look.
 *
 * Each family has one of the app's accent colours, worn neo-brutalist style: a solid chip with
 * a black border, and the colour as the card's border and hard shadow.
 */

const BUTTON =
  "flex w-full items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all text-center hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 motion-reduce:transform-none disabled:opacity-40 disabled:pointer-events-none";

export const BUTTONS = {
  rose: `${BUTTON} bg-red-600 hover:bg-red-500 text-white border-black shadow-[3px_3px_0px_0px_#facc15] hover:shadow-[4px_4px_0px_0px_#ffffff]`,
  amber: `${BUTTON} bg-yellow-400 hover:bg-yellow-300 text-black border-black shadow-[3px_3px_0px_0px_#ef4444] hover:shadow-[4px_4px_0px_0px_#ef4444]`,
  violet: `${BUTTON} bg-purple-600 hover:bg-purple-500 text-white border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#ffffff]`,
  blue: `${BUTTON} bg-blue-600 hover:bg-blue-500 text-white border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#ffffff]`,
  quiet: `${BUTTON} bg-[#1e2235] hover:bg-[#282d47] text-white border-white/20 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#ffffff]`,
};

const LOOKS = {
  free: {
    tag: "Free forever",
    tick: "#22c55e",
    chip: "bg-emerald-500 text-black border-black",
    card: "bg-[#13151f] border-2 border-white/20 shadow-[5px_5px_0px_0px_#000]",
    ring: "!border-emerald-500 !shadow-[5px_5px_0px_0px_#22c55e]",
    heading: "text-emerald-400",
    button: BUTTONS.quiet,
    solid: "bg-emerald-500 text-black",
    summary: "bg-[#13151f] border-white/20 shadow-[6px_6px_0px_0px_#22c55e]",
  },
  pro: {
    tag: "Individual pro",
    tick: "#facc15",
    chip: "bg-yellow-400 text-black border-black",
    card: "bg-[#13151f] border-2 border-yellow-400 shadow-[5px_5px_0px_0px_#facc15]",
    ring: "!border-yellow-400",
    heading: "text-yellow-400",
    button: BUTTONS.amber,
    solid: "bg-yellow-400 text-black",
    summary: "bg-[#13151f] border-yellow-400 shadow-[6px_6px_0px_0px_#facc15]",
  },
  business: {
    tag: "For teams",
    tick: "#c084fc",
    chip: "bg-purple-600 text-white border-black",
    card: "bg-[#13151f] border-2 border-purple-500 shadow-[5px_5px_0px_0px_#a855f7]",
    ring: "!border-purple-400",
    heading: "text-purple-400",
    button: BUTTONS.violet,
    solid: "bg-purple-600 text-white",
    summary: "bg-[#13151f] border-purple-500 shadow-[6px_6px_0px_0px_#a855f7]",
  },
  enterprise: {
    tag: "Organisations",
    tick: "#60a5fa",
    chip: "bg-blue-600 text-white border-black",
    card: "bg-[#13151f] border-2 border-blue-500 shadow-[5px_5px_0px_0px_#3b82f6]",
    ring: "!border-blue-400",
    heading: "text-blue-400",
    button: BUTTONS.blue,
    solid: "bg-blue-600 text-white",
    summary: "bg-[#13151f] border-blue-500 shadow-[6px_6px_0px_0px_#3b82f6]",
  },
};

const PLAIN = {
  tag: "",
  tick: "#22c55e",
  chip: "bg-[#1e2235] text-gray-200 border-white/20",
  card: "bg-[#13151f] border-2 border-white/20 shadow-[5px_5px_0px_0px_#000]",
  ring: "!border-white",
  heading: "text-gray-200",
  button: BUTTONS.quiet,
  solid: "bg-gray-600 text-white",
  summary: "bg-[#13151f] border-white/20 shadow-[6px_6px_0px_0px_#000]",
};

export const familyOf = (planId = "") => planId.replace(/_(monthly|annual|yearly)$/, "");

export const lookOf = (plan) => LOOKS[familyOf(plan?.id)] || PLAIN;
