/**
 * How each plan looks wherever it is shown: the tag above its name, its colour, its card, the
 * button beneath it, and its panel at checkout. Plans are told apart by family (pro_monthly
 * and pro_annual are both "pro"); a plan the list does not know gets the plain look.
 */

const BUTTON = "flex w-full items-center justify-center gap-2 min-h-[46px] px-4 rounded-[10px] text-sm font-bold transition-colors text-center disabled:opacity-40 disabled:pointer-events-none";

export const BUTTONS = {
  rose: `${BUTTON} bg-rose-600 hover:bg-rose-500 text-white`,
  amber: `${BUTTON} bg-amber-400 hover:bg-amber-300 text-[#1a1405]`,
  violet: `${BUTTON} bg-violet-600 hover:bg-violet-500 text-white`,
  quiet: `${BUTTON} bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.14] text-gray-100`,
};

const LOOKS = {
  free: {
    tag: "Free forever",
    tick: "#34d399",
    chip: "bg-emerald-400/[0.12] text-emerald-300",
    card: "bg-[#12141c] border border-white/[0.09]",
    ring: "!border-emerald-400/60",
    heading: "text-emerald-300",
    button: BUTTONS.quiet,
    solid: "bg-emerald-600",
    summary: "bg-[#12141c] border-white/[0.1]",
  },
  pro: {
    tag: "Individual pro",
    tick: "#fbbf24",
    chip: "bg-amber-400/[0.14] text-amber-300",
    card: "bg-gradient-to-b from-amber-400/[0.08] via-[#12141c] to-[#12141c] border border-amber-400/40",
    ring: "!border-amber-400",
    heading: "text-amber-300",
    button: BUTTONS.amber,
    solid: "bg-amber-500",
    summary: "bg-gradient-to-b from-amber-400/[0.10] via-[#12141c] to-[#12141c] border-amber-400/35",
  },
  business: {
    tag: "For teams",
    tick: "#a78bfa",
    chip: "bg-violet-400/[0.14] text-violet-300",
    card: "bg-gradient-to-b from-violet-500/[0.13] via-[#12141c] to-[#12141c] border border-violet-400/50",
    ring: "!border-violet-400",
    heading: "text-violet-300",
    button: BUTTONS.violet,
    solid: "bg-violet-600",
    summary: "bg-gradient-to-b from-violet-500/[0.12] via-[#12141c] to-[#12141c] border-violet-400/35",
  },
  enterprise: {
    tag: "Organisations",
    tick: "#60a5fa",
    chip: "bg-sky-400/[0.13] text-sky-300",
    card: "bg-[#12141c] border border-sky-400/30",
    ring: "!border-sky-400",
    heading: "text-sky-300",
    button: `${BUTTONS.quiet} !border-sky-400/45`,
    solid: "bg-sky-600",
    summary: "bg-[#12141c] border-sky-400/35",
  },
};

const PLAIN = { tag: "", tick: "#34d399", chip: "bg-white/[0.07] text-gray-300", card: "bg-[#12141c] border border-white/[0.09]", ring: "!border-white/40", heading: "text-gray-200", button: BUTTONS.quiet, solid: "bg-gray-600", summary: "bg-[#12141c] border-white/[0.1]" };

export const familyOf = (planId = "") => planId.replace(/_(monthly|annual|yearly)$/, "");

export const lookOf = (plan) => LOOKS[familyOf(plan?.id)] || PLAIN;
