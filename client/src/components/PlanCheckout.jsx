import { useState } from "react";
import toast from "react-hot-toast";
import { payFor, rupees } from "../utils/checkout";
import { savingOf, savingSaid } from "../utils/plans";

const day = (value) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// "month" as "every month", "one month", "Monthly"
const every = (interval) => (interval === "year" ? "every year" : "every month");
const one = (interval) => (interval === "year" ? "one year" : "one month");
const named = (interval) => (interval === "year" ? "Yearly" : "Monthly");

// How a plan may be bought. A price list that does not say sells it both ways.
const soldAs = (plan) => plan?.billing || { subscription: true, prepaid: true };

const stepper = "w-9 h-9 grid place-items-center rounded-xl bg-white/5 border border-white/10 hover:border-white/30 disabled:opacity-40 disabled:pointer-events-none text-white text-base font-bold";

const Choice = ({ checked, onChange, name, title, price, children }) => (
  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${checked ? "border-red-500 bg-red-500/10" : "border-white/10 bg-white/5 hover:border-white/30"}`}>
    <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1 h-4 w-4 shrink-0 accent-red-500" />
    <span className="flex-1 min-w-0">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-bold text-white">{title}</span>
        {price && <span className="text-sm font-black text-white whitespace-nowrap">{price}</span>}
      </span>
      {children && <span className="block text-xs text-gray-400 mt-1 leading-relaxed">{children}</span>}
    </span>
  </label>
);

/**
 * The one step every plan is bought through. It asks, in order:
 *   how many people    where the plan is sold by the seat and the number is still to be chosen
 *   how often          where the plan is sold both by the month and by the year
 *   how you pay        as a subscription that renews by itself, or prepaid for one period
 *   extra documents    optionally, a top-up pack added to the same payment
 * and then says what is charged today and what, if anything, is charged later.
 *
 * `plans` are the plans to choose between (the same plan by the month and by the year);
 * `planId` is the one chosen to begin with.
 * `ways` is what may be offered here: "auto" (subscription) and "once" (prepaid). Each plan
 * also says how it is sold, and only what both allow is shown. `prefer` is the way chosen to
 * begin with.
 * `paidUntil` is the date the account's time on this plan runs to, when it has some. Then a
 * subscription charges nothing today, and a prepaid period is added after that date.
 * `seats` is how many seats a plan sold by the seat is bought with; prices are for all of them.
 * `chooseSeats` lets the customer change that number here, up to `maxSeats`. It is left off
 * where the number is already settled: more time, or auto-renew, on a plan the account has.
 * `addOns` are the top-up packs that can be added.
 * `replacing` is the plan the account is on now, when this is a move to a different one:
 * `{ name, until }`. The new plan starts today and takes its place, and the window says so.
 * `switching` says the account's plan already renews, and this moves it to the plan's other
 * price (monthly to yearly, or back): the new subscription takes over when the paid time ends.
 *
 * `onDone` is called after a payment, with what payFor resolved to.
 */
export default function PlanCheckout({ open, plans, planId, ways = ["auto", "once"], prefer = "auto", paidUntil = null, seats = null, chooseSeats = false, maxSeats = 500, addOns = [], replacing = null, switching = false, onClose, onDone }) {
  const [chosenId, setChosenId] = useState(planId);
  // The number of seats as typed; it may be empty or out of range while it is being changed
  const [typedSeats, setTypedSeats] = useState(String(Math.max(1, Number(seats) || 1)));
  const [wanted, setWanted] = useState(prefer);
  const [addOn, setAddOn] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const plan = plans.find((p) => p.id === chosenId) || plans[0];
  const available = ways.filter((way) => (way === "auto" ? soldAs(plan).subscription : soldAs(plan).prepaid));
  // Changing the period can leave the way that was chosen unavailable; the first one that is takes its place
  const renew = available.includes(wanted) ? wanted : available[0];

  const most = Math.max(1, Number(maxSeats) || 1);
  const count = plan.perSeat ? Math.min(most, Math.max(1, Math.floor(Number(chooseSeats ? typedSeats : seats)) || 1)) : 1;
  const stepSeats = (by) => setTypedSeats(String(Math.min(most, Math.max(1, count + by))));
  const amountOf = (option) => option.priceInr * (option.perSeat ? count : 1);
  const price = rupees(amountOf(plan));
  const documents =
    plan.documentsPerMonth === null
      ? "No monthly limit on documents"
      : plan.perSeat
        ? `${count} seat${count === 1 ? "" : "s"}, ${plan.documentsPerMonth * count} documents a month shared by the team`
        : `${plan.documentsPerMonth} documents a month`;

  // A subscription turned on while time is still paid for takes nothing today, so nothing can be added to it
  const nothingToday = renew === "auto" && Boolean(paidUntil);
  const pack = nothingToday ? null : addOns.find((option) => option.id === addOn) || null;
  const today = nothingToday ? 0 : amountOf(plan) + (pack?.priceInr || 0);

  const pay = async () => {
    try {
      setBusy(true);
      const outcome = await payFor("plan", plan.id, { renew, seats: plan.perSeat ? count : undefined, addOn: pack?.id });
      if (outcome === "cancelled") return;
      toast.success(
        outcome === "simulated"
          ? "Simulated payment applied."
          : outcome === "processing"
            ? "Payment received. Your plan will show here in a moment."
            : renew === "auto"
              ? "Your subscription is active."
              : "Payment received. Your plan is active."
      );
      await onDone(outcome);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`Get ${plan.name}`} data-testid="plan-checkout">
      {/* The choices scroll; what is charged and the button to pay stay in view beneath them */}
      <div className="bg-[#12141c] border border-white/15 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">{paidUntil ? plan.name : `Get ${plan.name}`}</h2>
            <p className="text-xs text-gray-400 mt-1">{documents}. Prices include GST.</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 space-y-5">
          {replacing && (
            <p className="px-4 py-3 rounded-xl border-2 border-amber-400/40 bg-amber-400/10 text-amber-100 text-xs leading-relaxed" role="note" data-testid="checkout-replacing">
              You are on {replacing.name} now{replacing.until ? `, until ${day(replacing.until)}` : ""}. {plan.name} starts today and takes its place{replacing.until ? "; the time left on the present plan is not carried over" : ""}.
            </p>
          )}
          {switching && paidUntil && (
            <p className="px-4 py-3 rounded-xl border-2 border-sky-400/40 bg-sky-400/10 text-sky-100 text-xs leading-relaxed" role="note" data-testid="checkout-switching">
              Your plan stays as it is until {day(paidUntil)}. From then it is paid {named(plan.interval).toLowerCase()}: the payments you make now stop, and this one takes their place. Nothing is charged today.
            </p>
          )}
          {plan.perSeat && chooseSeats && (
            <fieldset data-testid="checkout-seats">
              <legend className="text-[11px] uppercase font-bold text-gray-500 mb-2">How many people</legend>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => stepSeats(-1)} disabled={busy || count <= 1} aria-label="One seat fewer" className={stepper}>
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={most}
                  step="1"
                  value={typedSeats}
                  onChange={(e) => setTypedSeats(e.target.value)}
                  onBlur={() => setTypedSeats(String(count))}
                  disabled={busy}
                  aria-label="Number of seats"
                  className="w-20 px-2 py-2 text-center rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:outline-none focus:border-red-500"
                />
                <button type="button" onClick={() => stepSeats(1)} disabled={busy || count >= most} aria-label="One seat more" className={stepper}>
                  +
                </button>
                <span className="text-xs text-gray-400">
                  {rupees(plan.priceInr)} a seat, a {plan.interval}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">One seat for each person on the team, including you. You set up the team and invite them after paying.</p>
            </fieldset>
          )}

          {plans.length > 1 && (
            <fieldset className="space-y-2">
              <legend className="text-[11px] uppercase font-bold text-gray-500 mb-2">How often</legend>
              {plans.map((option) => {
                // Two plans with the same period are told apart by their names
                const alone = plans.filter((other) => other.interval === option.interval).length === 1;
                // What a year saves over twelve of the months offered beside it
                const monthly = option.interval === "year" ? plans.find((other) => other.interval === "month") : null;
                const saving = monthly ? savingOf(monthly.priceInr, option.priceInr) : null;
                return (
                  <Choice
                    key={option.id}
                    name="plan"
                    checked={option.id === plan.id}
                    onChange={() => setChosenId(option.id)}
                    title={`${alone ? named(option.interval) : `${option.name}, ${named(option.interval).toLowerCase()}`}${savingSaid(saving) ? ` · ${savingSaid(saving)}` : ""}`}
                    price={`${rupees(amountOf(option))} a ${option.interval}`}
                  >
                    {saving && `${rupees(saving.perMonthInr * count)} a month, paid once a year.`}
                  </Choice>
                );
              })}
            </fieldset>
          )}

          {available.length === 0 ? (
            <p className="text-sm text-amber-200" role="alert">
              This plan cannot be bought that way at the moment. Choose another, or look at the pricing page.
            </p>
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-[11px] uppercase font-bold text-gray-500 mb-2">How you pay</legend>
              {available.includes("auto") && (
                <Choice name="renew" checked={renew === "auto"} onChange={() => setWanted("auto")} title="Subscription: renews automatically" price={`${price} ${every(plan.interval)}`}>
                  {paidUntil
                    ? `Nothing is charged today. ${price} is charged on ${day(paidUntil)}, when the time you have paid for ends, and ${every(plan.interval)} after that.`
                    : `${price} is charged today and ${every(plan.interval)} after that, from the card or UPI you approve.`}{" "}
                  You can turn it off at any time from Billing, and keep what you have paid for.
                  {plan.perSeat && " To change the number of seats later, turn it off and on again."}
                </Choice>
              )}
              {available.includes("once") && (
                <Choice name="renew" checked={renew === "once"} onChange={() => setWanted("once")} title={`Prepaid: ${one(plan.interval)} only`} price={`${price} once`}>
                  {paidUntil
                    ? `${price} is charged today, and ${one(plan.interval)} is added after ${day(paidUntil)}. Nothing is charged again unless you choose to.`
                    : `${price} is charged today for ${one(plan.interval)}. Nothing is charged again unless you choose to.`}
                </Choice>
              )}
            </fieldset>
          )}

          {addOns.length > 0 && available.length > 0 && !nothingToday && (
            <fieldset className="space-y-2" data-testid="checkout-addons">
              <legend className="text-[11px] uppercase font-bold text-gray-500 mb-2">Add extra documents (optional)</legend>
              <p className="text-xs text-gray-400">One payment with your plan. They are used after each month's allowance and never expire. You can also buy them later, whenever you need them.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAddOn("")}
                  aria-pressed={!pack}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border ${!pack ? "border-red-500 bg-red-500/10 text-white" : "border-white/10 bg-white/5 text-gray-300 hover:border-white/30"}`}
                >
                  None
                </button>
                {addOns.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAddOn(option.id)}
                    aria-pressed={pack?.id === option.id}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border ${pack?.id === option.id ? "border-red-500 bg-red-500/10 text-white" : "border-white/10 bg-white/5 text-gray-300 hover:border-white/30"}`}
                  >
                    +{option.documents} documents · {rupees(option.priceInr)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

        </div>

        {available.length > 0 && (
          <div className="px-6 pt-4 pb-6 border-t border-white/10 space-y-3">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="checkout-summary">
              <div className="flex justify-between gap-3 text-white font-bold">
                <span>Charged today</span>
                <span>{rupees(today)}</span>
              </div>
              {pack && (
                <p className="text-xs text-gray-400 mt-1">
                  {plan.name} {price} + {pack.documents} extra documents {rupees(pack.priceInr)}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {renew === "auto"
                  ? nothingToday
                    ? `Then ${price} on ${day(paidUntil)} and ${every(plan.interval)} after, until you turn it off.`
                    : `Then ${price} ${every(plan.interval)}, until you turn it off.`
                  : "Nothing after that."}
              </p>
            </div>

            <button onClick={pay} disabled={busy} className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold">
              {busy ? "Opening payment…" : nothingToday ? (switching ? `Switch to ${named(plan.interval).toLowerCase()} billing` : "Turn on auto-renew") : renew === "auto" ? `Pay ${rupees(today)} and subscribe` : `Pay ${rupees(today)}`}
            </button>
            <p className="text-[11px] text-gray-500 text-center">Payments are taken by Razorpay. PactDoc does not see or keep your card or UPI details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
