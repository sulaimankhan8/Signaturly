import { priceShown, pointsOf, savingSaid } from "../utils/plans";
import { rupees } from "../utils/checkout";
import { lookOf } from "../utils/planLook";

const Tick = ({ color }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// What the plan costs. Every plan is shown by the month; what is really charged is beneath.
const Price = ({ price, large }) => {
  const figure = `${large ? "text-5xl" : "text-4xl"} font-black text-white tracking-tight`;
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
        <span className="block -mt-1 mb-0.5 text-[10px] text-gray-400 font-black uppercase tracking-wider">Starting from</span>
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
            <s className="text-base text-gray-500 font-bold">{rupees(price.wasInr)}</s>{" "}
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
  const look = lookOf(plan);
  const marked = current || plan.highlight;
  const ribbon = current ? ["Your plan", "bg-yellow-400 text-black"] : plan.highlight ? ["Most popular", "bg-red-600 text-white"] : null;
  const frame = marked
    ? `border-yellow-400 ${large ? "shadow-[8px_8px_0px_0px_#ef4444]" : "shadow-[5px_5px_0px_0px_#ef4444]"}`
    : `${look.frame} ${large ? "shadow-[6px_6px_0px_0px_rgba(255,255,255,0.12)]" : "shadow-[4px_4px_0px_0px_#000]"}`;

  return (
    <li data-testid={testId} className={`relative flex flex-col bg-[#13151f] border-2 ${large ? "p-6 sm:p-7 rounded-3xl" : "p-5 sm:p-6 rounded-2xl"} ${frame} transition-transform hover:-translate-y-1 motion-reduce:transform-none`}>
      {look.glow && <span className={`absolute inset-0 rounded-[inherit] pointer-events-none ${look.glow}`} aria-hidden="true" />}
      {ribbon && (
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border-2 border-black whitespace-nowrap ${ribbon[1]}`}>{ribbon[0]}</span>
      )}

      <div className="relative flex flex-col flex-1">
        {look.tag && <span className={`self-start px-2 py-0.5 rounded-md border text-[10px] font-bold font-mono uppercase tracking-wider ${look.chip}`}>{look.tag}</span>}
        <h3 className={`${large ? "text-2xl" : "text-xl"} font-black text-white mt-3`}>{plan.name}</h3>

        <div className={`mt-3 ${large ? "min-h-[5.5rem]" : "min-h-[5rem]"}`}>
          <Price price={priceShown(offer, period)} large={large} />
        </div>

        {/* The same height whether or not the plan says who it is for, so the lists line up */}
        <p className="text-xs text-gray-400 leading-relaxed min-h-[2.5rem]">{plan.tagline}</p>

        <ul className="mt-5 pt-5 border-t border-white/10 space-y-2.5 text-[13px] text-gray-100 font-semibold flex-1">
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
