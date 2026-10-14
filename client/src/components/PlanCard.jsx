import { priceShown, pointsOf, savingSaid } from "../utils/plans";
import { rupees } from "../utils/checkout";
import { lookOf } from "../utils/planLook";

const Tick = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-[3px]" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// What the plan costs. Every plan is shown by the month; what is really charged is beneath.
const Price = ({ price, large }) => {
  const figure = `font-display ${large ? "text-5xl" : "text-[40px]"} leading-[1.1] font-bold text-white tracking-tight`;
  const unit = "text-sm text-gray-400 font-medium";
  const beneath = "block text-[13px] text-gray-400 mt-1";
  const each = price.seat ? "/ seat / month" : "/ month";

  if (price.kind === "free") {
    return (
      <p>
        <span className={figure}>{rupees(0)}</span>
        <span className={beneath}>Free, for as long as you like</span>
      </p>
    );
  }
  if (price.kind === "none") return <p className="text-sm font-bold text-gray-300">No longer sold</p>;
  if (price.kind === "from") {
    return (
      <p>
        <span className="block mb-0.5 text-xs text-gray-400 font-bold uppercase tracking-[0.06em]">Starting from</span>
        <span className={figure}>{rupees(price.amountInr)}</span>
        <span className={unit}> {each}</span>
        <span className={beneath}>The price is agreed with you</span>
      </p>
    );
  }
  if (price.kind === "yearly") {
    return (
      <p>
        {price.wasInr && (
          <>
            <s className="font-display text-lg text-gray-500 font-medium mr-1.5">{rupees(price.wasInr)}</s>
          </>
        )}
        <span className={figure}>{rupees(price.amountInr)}</span>
        <span className={unit}> {each}</span>
        <span className={beneath}>
          Billed yearly ·{" "}
          <span className="whitespace-nowrap">
            {rupees(price.totalInr)} a {price.seat ? "seat a " : ""}year
          </span>
        </span>
        {savingSaid(price.saving) && <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-amber-400 text-[#1a1405] text-[11px] font-bold whitespace-nowrap">{savingSaid(price.saving)}</span>}
      </p>
    );
  }
  return (
    <p>
      <span className={figure}>{rupees(price.amountInr)}</span>
      <span className={unit}> {price.kind === "year" ? (price.seat ? "/ seat / year" : "/ year") : each}</span>
      <span className={beneath}>{price.kind === "year" ? "Billed yearly" : price.only ? "Billed monthly only" : "Billed monthly"}</span>
    </p>
  );
};

/**
 * One plan, as every page shows it: the landing page, the pricing page and Billing. Its
 * name, who it is for, what it costs in the view chosen, what it includes, and beneath that
 * whatever the page lets the visitor do about it (`children`).
 *
 * `offer` is a plan with its yearly price (utils/plans.js); `period` is "month" or "year".
 * `current` marks the plan the account is on, `recommended` the one we point them to.
 * `large` is the roomier card of the public pages.
 */
export default function PlanCard({ offer, period, current = false, recommended = false, large = false, testId, children }) {
  const { plan } = offer;
  const look = lookOf(plan);
  const ribbon = current
    ? ["Your plan", "bg-amber-400 text-[#1a1405]"]
    : recommended
      ? ["Recommended for you", "bg-violet-600 text-white"]
      : plan.highlight
        ? ["Most popular", "bg-rose-600 text-white"]
        : null;
  const frame = current ? `${look.card} !border-2 ${look.ring}` : look.card;

  return (
    <li data-testid={testId} className={`relative flex flex-col ${frame} ${large ? "p-7 rounded-3xl" : "p-6 rounded-[18px]"} transition-transform hover:-translate-y-1 motion-reduce:transform-none`}>
      {ribbon && <span className={`absolute -top-[13px] left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${ribbon[1]}`}>{ribbon[0]}</span>}

      <div className="relative flex flex-col flex-1">
        {look.tag && <span className={`self-start px-2.5 py-[3px] rounded-full text-xs font-bold ${look.chip}`}>{look.tag}</span>}
        <h3 className={`font-display ${large ? "text-[28px]" : "text-2xl"} font-bold text-white mt-3.5`}>{plan.name}</h3>
        {/* The same height whether or not the plan says who it is for, so the prices line up */}
        <p className="mt-1 text-sm text-gray-400 leading-relaxed min-h-[2.75rem]">{plan.tagline}</p>

        <div className={`mt-3.5 ${large ? "min-h-[6rem]" : "min-h-[5.5rem]"}`}>
          <Price price={priceShown(offer, period)} large={large} />
        </div>

        <ul className="mt-5 pt-5 border-t border-white/[0.08] grid gap-2.5 content-start text-sm text-gray-200 flex-1">
          {pointsOf(plan).map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <Tick color={look.tick} />
              {point}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2">{children}</div>
      </div>
    </li>
  );
}
