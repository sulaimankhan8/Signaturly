import { priceShown, pointsOf, savingSaid } from "../utils/plans";
import { rupees } from "../utils/checkout";
import { lookOf } from "../utils/planLook";

const Tick = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-[3px]" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * What the plan costs, always in the same three lines so that every card's price sits at the
 * same height: a line above the figure (the monthly price struck through with what a year
 * saves, or "Starting from"), the figure with a short unit that never wraps, and what is
 * really charged. Every plan is shown by the month.
 */
const Price = ({ price, large }) => {
  const figure = `${large ? "text-5xl" : "text-[44px]"} leading-[50px] font-black text-white tracking-tight tabular-nums`;
  const unit = "text-sm text-gray-400 font-bold";
  const eyebrow = "text-[11px] font-black uppercase tracking-wider text-gray-400";
  const each = price.seat ? "/seat/mo" : "/mo";

  // [above the figure, the figure, its unit, what is charged]
  const [above, amount, per, billed] =
    price.kind === "free"
      ? [<span className={eyebrow}>No card needed</span>, rupees(0), "", "Free, for as long as you like"]
      : price.kind === "none"
        ? [null, "—", "", "No longer sold"]
        : price.kind === "from"
          ? [<span className={eyebrow}>Starting from</span>, rupees(price.amountInr), each, "Price agreed with you"]
          : price.kind === "yearly"
            ? [
                <>
                  {price.wasInr && <s className="text-[15px] text-gray-500 font-bold decoration-red-500 decoration-2">{rupees(price.wasInr)}</s>}
                  {savingSaid(price.saving) && (
                    <span className="px-1.5 py-px rounded-[5px] border-2 border-black bg-yellow-400 text-black text-[10px] leading-[14px] font-black uppercase tracking-wider whitespace-nowrap">{savingSaid(price.saving)}</span>
                  )}
                </>,
                rupees(price.amountInr),
                each,
                `Billed ${rupees(price.totalInr)}${price.seat ? " a seat" : ""}, once a year`,
              ]
            : price.kind === "year"
              ? [null, rupees(price.amountInr), price.seat ? "/seat/yr" : "/yr", "Billed yearly"]
              : [price.seat ? <span className={eyebrow}>Per seat</span> : null, rupees(price.amountInr), each, price.only ? "Billed monthly only" : price.seat ? "Billed monthly, per seat" : "Billed monthly"];

  return (
    <div className="h-[98px] flex flex-col">
      <div className="h-[22px] flex items-center gap-2">{above}</div>
      <p className="mt-0.5 h-[50px] flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={figure}>{amount}</span>
        {per && <span className={unit}>{per}</span>}
      </p>
      <p className="mt-0.5 h-5 text-[13px] leading-5 text-gray-400 truncate">{billed}</p>
    </div>
  );
};

/**
 * One plan, as every page shows it: the landing page, the pricing page and Billing.
 *
 * Every card is built from the same rows, each of a fixed height, so that across a row of
 * cards the tags, names, prices and buttons all line up whatever each plan says: the tag, the
 * name, who it is for (two lines, always), the price (three lines, always), then what the page
 * lets the visitor do about it (`children`: a button and one short line), and last what the
 * plan includes. The button comes before the features so that it is in view without scrolling.
 *
 * `offer` is a plan with its yearly price (utils/plans.js); `period` is "month" or "year".
 * `previous` is the plan on the card before, when there is one: a plan above Pro lists only
 * what it adds to it ("Everything in Pro, plus").
 * `current` marks the plan the account is on, `recommended` the one we point them to.
 * `large` is the roomier card of the public pages.
 */
export default function PlanCard({ offer, period, previous = null, current = false, recommended = false, large = false, testId, children }) {
  const { plan } = offer;
  const look = lookOf(plan);
  // A sticker on the card's top edge, tilted a little, as the landing page does it
  const ribbon = current
    ? ["Your plan", "bg-yellow-400 text-black"]
    : recommended
      ? ["Recommended", "bg-purple-600 text-white"]
      : plan.highlight
        ? ["Most popular", "bg-red-600 text-white"]
        : null;
  const frame = current ? `${look.card} ${look.ring}` : look.card;

  // The bigger plans say what they add to the one before, so the lists stay short
  const points = pointsOf(plan);
  const summarise = Boolean(previous) && previous.priceInr > 0;
  const before = summarise ? new Set(pointsOf(previous)) : null;
  const shown = summarise ? points.filter((point) => !before.has(point)) : points;

  return (
    <li data-testid={testId} className={`relative flex flex-col ${frame} ${large ? "p-7" : "px-[22px] pt-[22px] pb-6"} rounded-2xl transition-transform hover:-translate-x-0.5 hover:-translate-y-1 motion-reduce:transform-none`}>
      {ribbon && (
        <span className={`absolute -top-3.5 right-5 -rotate-2 px-2.5 py-1 rounded-md border-2 border-black text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-[2px_2px_0px_0px_#000] ${ribbon[1]}`}>{ribbon[0]}</span>
      )}

      <div className="relative flex flex-col flex-1">
        <div className="h-[22px]">{look.tag && <span className={`inline-block px-2 py-0.5 rounded-md border-2 text-[10px] leading-[14px] font-black uppercase tracking-wider ${look.chip}`}>{look.tag}</span>}</div>
        <h3 className={`mt-3 h-8 ${large ? "text-[28px]" : "text-[26px]"} leading-8 font-black uppercase tracking-tight text-white truncate`}>{plan.name}</h3>
        <p className="mt-1 h-10 text-sm leading-5 text-gray-400 line-clamp-2">{plan.tagline}</p>

        <div className="mt-4">
          <Price price={priceShown(offer, period)} large={large} />
        </div>

        <div className="mt-4 flex flex-col gap-2">{children}</div>

        <div className="mt-4 pt-4 border-t-2 border-dashed border-white/10 flex-1">
          <p className="mb-2.5 text-[11px] font-black uppercase tracking-wider" style={{ color: look.tick }}>
            {summarise ? `Everything in ${previous.name}, plus` : "Includes"}
          </p>
          <ul className="grid gap-2.5 content-start text-sm font-medium text-gray-200">
            {shown.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <Tick color={look.tick} />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
