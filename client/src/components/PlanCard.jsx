import { priceShown, pointsOf, savingSaid } from "../utils/plans";
import { rupees } from "../utils/checkout";

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" className="shrink-0 mt-0.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// What the plan costs. Every plan is shown by the month; what is really charged is beneath.
const Price = ({ price, large }) => {
  const figure = `${large ? "text-4xl" : "text-3xl"} font-black text-white font-mono`;
  const unit = "text-xs text-gray-400 font-bold";
  const beneath = "block text-[11px] text-gray-400 mt-1.5";
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
        <span className="text-xs text-gray-400 font-black uppercase tracking-wider">from </span>
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
            <s className="text-sm text-gray-500 font-bold font-mono">{rupees(price.wasInr)}</s>{" "}
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
        {savingSaid(price.saving) && <span className="inline-block mt-1 px-1.5 py-px rounded bg-yellow-400 text-black text-[9px] font-black uppercase border border-black whitespace-nowrap">{savingSaid(price.saving)}</span>}
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
 * `current` marks the plan the account is on. `large` is the roomier card of the public pages.
 */
export default function PlanCard({ offer, period, current = false, large = false, testId, children }) {
  const { plan } = offer;
  const marked = current || plan.highlight;
  const frame = marked ? (large ? "border-yellow-400 shadow-[8px_8px_0px_0px_#ef4444]" : "border-yellow-400 shadow-[4px_4px_0px_0px_#ef4444]") : large ? "border-white/20 shadow-[6px_6px_0px_0px_#fff]" : "border-white/15 shadow-[4px_4px_0px_0px_#000]";

  return (
    <li data-testid={testId} className={`flex flex-col bg-[#13151f] border-2 ${large ? "p-6 sm:p-7 rounded-3xl" : "p-5 rounded-2xl"} ${frame}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={`${large ? "text-xl" : "text-base"} font-black text-white uppercase`}>{plan.name}</h3>
        {current ? (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border-2 border-black bg-yellow-400 text-black whitespace-nowrap">Your plan</span>
        ) : (
          plan.highlight && <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border-2 border-black bg-red-600 text-white whitespace-nowrap">Most popular</span>
        )}
      </div>
      {/* The same height whether or not the plan says who it is for, so the prices line up */}
      <p className={`text-xs text-gray-400 mt-1 ${large ? "min-h-[2.5rem]" : "min-h-[2rem]"}`}>{plan.tagline}</p>

      <div className={`mt-3 ${large ? "min-h-[5.5rem]" : "min-h-[5rem]"}`}>
        <Price price={priceShown(offer, period)} large={large} />
      </div>

      <ul className={`mt-4 space-y-2 text-xs text-gray-200 flex-1 ${large ? "font-bold" : ""}`}>
        {pointsOf(plan).map((point) => (
          <li key={point} className="flex items-start gap-2">
            <Tick />
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2">{children}</div>
    </li>
  );
}
