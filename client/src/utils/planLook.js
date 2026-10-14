/**
 * How each plan looks on its card: the tag above its name, its colour, and the button
 * beneath it. Plans are told apart by family (pro_monthly and pro_annual are both "pro");
 * a plan the list does not know gets the plain look.
 */

const BUTTON = "block w-full text-center py-3.5 font-black uppercase tracking-wider rounded-xl text-xs border-2 transition-all disabled:opacity-40 disabled:pointer-events-none";

export const BUTTONS = {
  yellow: `${BUTTON} bg-yellow-400 hover:bg-yellow-300 text-black border-black shadow-[4px_4px_0px_0px_#ef4444] hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0px_0px_#ef4444]`,
  violet: `${BUTTON} bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-black shadow-[4px_4px_0px_0px_#000]`,
  quiet: `${BUTTON} bg-white/[0.07] hover:bg-white/[0.14] text-white border-white/20`,
};

const LOOKS = {
  free: {
    tag: "Free forever",
    tick: "#34d399",
    chip: "text-gray-300 border-white/15 bg-white/5",
    frame: "border-white/15",
    button: BUTTONS.quiet,
  },
  pro: {
    tag: "Individual pro",
    tick: "#facc15",
    chip: "text-yellow-300 border-yellow-400/40 bg-yellow-400/10",
    frame: "border-yellow-400",
    button: BUTTONS.yellow,
  },
  business: {
    tag: "For teams",
    tick: "#a78bfa",
    chip: "text-violet-300 border-violet-400/40 bg-violet-500/10",
    frame: "border-violet-500/70",
    glow: "bg-gradient-to-b from-violet-600/[0.12] to-transparent",
    button: BUTTONS.violet,
  },
  enterprise: {
    tag: "Organisations",
    tick: "#60a5fa",
    chip: "text-blue-300 border-blue-400/40 bg-blue-500/10",
    frame: "border-white/15",
    button: BUTTONS.quiet,
  },
};

const PLAIN = { tag: "", tick: "#34d399", chip: "", frame: "border-white/15", button: BUTTONS.quiet };

export const familyOf = (planId = "") => planId.replace(/_(monthly|annual|yearly)$/, "");

export const lookOf = (plan) => LOOKS[familyOf(plan?.id)] || PLAIN;
