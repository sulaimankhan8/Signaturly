import { rupees, SETUP_CHECK } from "../../utils/checkout";
import { day } from "../../utils/billing";
import { lookOf } from "../../utils/planLook";
import { every, one, named, payLabelOf } from "../../hooks/useCheckoutQuote";
import { ChoiceCard, Note, Pill, SaveBadge, Stepper, Spinner, PayMethods } from "./ui";
import { BTN, ICONS } from "./theme";

/**
 * The parts of checkout shared by the full checkout page and the pop-up used in the middle of
 * sending: the choices, and the summary with the button that pays. Both are drawn from one
 * quote (hooks/useCheckoutQuote.js).
 */

// One group of choices, with its heading and its place in the order. On the page each sits in its own panel.
const Group = ({ number, title, hint, framed, testId, children }) => (
  <fieldset data-testid={testId} className={framed ? "bg-[#13151f] border-2 border-white/20 rounded-2xl shadow-[4px_4px_0px_0px_#000] px-5 sm:px-6 py-5" : ""}>
    <legend className={framed ? "float-left w-full" : "w-full"}>
      <span className="flex items-center gap-2.5 text-sm font-black uppercase tracking-wider text-white">
        {number && (
          <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md border-2 border-black bg-yellow-400 text-black text-xs font-black" aria-hidden="true">
            {number}
          </span>
        )}
        {title}
      </span>
      {hint && <span className="block mt-1 text-[13px] text-gray-400 font-normal normal-case tracking-normal leading-relaxed">{hint}</span>}
    </legend>
    <div className="clear-both pt-3.5">{children}</div>
  </fieldset>
);

export function CheckoutChoices({ quote, busy = false, chooseSeats = false, framed = false }) {
  const { plan } = quote;
  if (!plan) return null;

  // Each group shown is numbered in turn, so the page reads as steps to the button that pays
  let shown = 0;
  const seatsAt = plan.perSeat && chooseSeats ? ++shown : null;
  const periodAt = quote.periods.length > 1 ? ++shown : null;
  const payAt = quote.available.length > 0 ? ++shown : null;
  const packAt = quote.canAddPack ? ++shown : null;

  return (
    <div className="grid gap-5">
      {seatsAt && (
        <Group number={seatsAt} framed={framed} title="Team size" hint="One seat for each person who sends documents, including you. You invite them after paying." testId="checkout-seats">
          <div className="flex flex-wrap items-center gap-3">
            <Stepper
              onLess={() => quote.stepSeats(-1)}
              onMore={() => quote.stepSeats(1)}
              lessDisabled={busy || quote.count <= 1}
              moreDisabled={busy || quote.count >= quote.most}
              lessLabel="One seat fewer"
              moreLabel="One seat more"
            >
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max={quote.most}
                step="1"
                value={quote.typedSeats}
                onChange={(event) => quote.setTypedSeats(event.target.value)}
                onBlur={() => quote.setTypedSeats(String(quote.count))}
                disabled={busy}
                aria-label="Number of seats"
                className="w-[72px] h-11 text-center rounded-xl border-2 border-white/20 bg-[#090a0f] text-white text-lg font-black tabular-nums focus:outline-none focus:border-yellow-400"
              />
            </Stepper>
            <span className="text-sm font-medium text-gray-300">
              {rupees(plan.priceInr)} a seat a {plan.interval} · <strong className="font-black text-white">{rupees(quote.planAmount)}</strong> in all
            </span>
          </div>
        </Group>
      )}

      {periodAt && (
        <Group number={periodAt} framed={framed} title="Billing period">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quote.periods.map(({ option, amount, saving, perMonth, saved }) => (
              <ChoiceCard
                key={option.id}
                name="period"
                checked={option.id === plan.id}
                onChange={() => quote.choosePlan(option.id)}
                disabled={busy}
                title={named(option.interval)}
                badge={saving?.monthsFree ? <SaveBadge>{`${saving.monthsFree} months free`}</SaveBadge> : saving?.percent > 0 ? <SaveBadge>{`Save ${saving.percent}%`}</SaveBadge> : null}
              >
                <span className="block text-xl font-black text-white tabular-nums">
                  {rupees(amount)}
                  <span className="text-[13px] font-bold text-gray-400"> / {option.interval}</span>
                </span>
                {perMonth ? `${rupees(perMonth)} a month · you save ${rupees(saved)}` : "Most flexible"}
              </ChoiceCard>
            ))}
          </div>
        </Group>
      )}

      {quote.available.length === 0 ? (
        <p className="text-sm font-bold text-yellow-300" role="alert">
          This plan cannot be bought that way at the moment. Choose another, or look at the plans page.
        </p>
      ) : (
        <Group number={payAt} framed={framed} title="How you pay">
          <div className="grid gap-3">
            {quote.available.includes("auto") && (
              <ChoiceCard
                name="renew"
                checked={quote.renew === "auto"}
                onChange={() => quote.chooseWay("auto")}
                disabled={busy}
                title="Auto-renew"
                badge={quote.available.length > 1 ? <Pill tone="green">Recommended</Pill> : null}
                price={`${quote.price} ${every(plan.interval)}`}
              >
                {quote.change === "downgrade" && quote.firstChargeOn
                  ? `${plan.name} starts on ${day(quote.firstChargeOn)}, when your ${quote.current?.name || "present"} plan ends; you keep that plan until then. Nothing is charged today; ${quote.price} is charged then, and ${every(plan.interval)} after that.`
                  : quote.change === "upgrade" && quote.firstChargeOn
                    ? `${plan.name} starts today. Your unused ${quote.credit?.from || "plan"} time pays for it until ${day(quote.firstChargeOn)}, so nothing is charged today; then ${quote.price} ${every(plan.interval)}.`
                    : quote.firstChargeOn
                      ? `Nothing is charged today. ${quote.price} is charged on ${day(quote.firstChargeOn)}, when the time you have paid for ends, and ${every(plan.interval)} after that.`
                      : `Charged today and ${every(plan.interval)} after that, from the UPI or card you approve once.`}{" "}
                Turn it off any time from Billing; you keep what you have paid for.
                {plan.perSeat && " To change the number of seats later, turn it off and on again."}
              </ChoiceCard>
            )}
            {quote.available.includes("once") && (
              <ChoiceCard
                name="renew"
                checked={quote.renew === "once"}
                onChange={() => quote.chooseWay("once")}
                disabled={busy}
                title={`Pay once: ${one(plan.interval)}`}
                price={`${quote.price} once`}
              >
                {quote.paidUntil
                  ? `${quote.price} today, and ${one(plan.interval)} is added after ${day(quote.paidUntil)}. Nothing is charged again unless you choose to.`
                  : quote.credit
                    ? `${quote.price} today for ${one(plan.interval)}, plus ${quote.credit.days} extra days for your unused ${quote.credit.from} time. Nothing is charged again unless you choose to.`
                    : `${quote.price} today for ${one(plan.interval)}. Nothing is charged again unless you choose to.`}
              </ChoiceCard>
            )}
          </div>
        </Group>
      )}

      {packAt && (
        <Group
          number={packAt}
          framed={framed}
          title={
            <>
              Extra documents <span className="text-gray-500">(optional)</span>
            </>
          }
          hint="One-time, in the same payment. Used after the monthly allowance; they never expire."
          testId="checkout-addons"
        >
          <div className="flex flex-wrap gap-2">
            {[null, ...quote.addOns].map((option) => {
              const on = (quote.pack?.id || null) === (option?.id || null);
              return (
                <button
                  key={option?.id || "none"}
                  type="button"
                  onClick={() => quote.chooseAddOn(option?.id || "")}
                  aria-pressed={on}
                  disabled={busy}
                  className={`min-h-[44px] px-3.5 rounded-xl border-2 text-sm font-black transition-all ${on ? "border-yellow-400 bg-yellow-400/10 text-white shadow-[3px_3px_0px_0px_#facc15]" : "border-white/15 bg-[#0f1118] text-gray-200 hover:border-white/35"}`}
                >
                  {option ? `+${option.documents} documents · ${rupees(option.priceInr)}` : "None"}
                </button>
              );
            })}
          </div>
        </Group>
      )}
    </div>
  );
}

export function OrderSummary({ quote, busy = false, switching = false, onPay, payDisabled = false, framed = true }) {
  const { plan } = quote;
  if (!plan) return null;
  const look = lookOf(plan);

  return (
    <div className={framed ? `rounded-2xl p-6 border-2 ${look.summary}` : ""}>
      {framed && <h2 className="text-[11px] font-black uppercase tracking-wider text-gray-300">Order summary</h2>}

      <div className={`${framed ? "mt-4" : ""} flex items-center gap-3`}>
        <span className={`w-11 h-11 shrink-0 rounded-xl border-2 border-black grid place-items-center shadow-[2px_2px_0px_0px_#000] ${look.solid}`} aria-hidden="true">
          {plan.perSeat ? <ICONS.users className="w-5 h-5" /> : <ICONS.doc className="w-5 h-5" />}
        </span>
        <div className="min-w-0">
          <p className="font-black text-white">
            <span className="uppercase">{plan.name}</span> · {named(plan.interval)}
          </p>
          <p className="text-xs font-bold text-gray-400">
            {plan.perSeat ? `${quote.count} seat${quote.count === 1 ? "" : "s"} · ` : ""}
            {quote.renew === "auto" ? "auto-renew" : "pay once"}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-2.5 text-sm" data-testid="checkout-summary">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-300">
            {plan.name}
            {plan.perSeat ? `, ${quote.count} × ${rupees(plan.priceInr)}` : ""}
          </dt>
          <dd className="text-white font-black tabular-nums">{quote.nothingToday ? `from ${day(quote.firstChargeOn)}` : quote.price}</dd>
        </div>
        {quote.credit && (
          <div className="flex justify-between gap-3" data-testid="checkout-credit">
            <dt className="text-emerald-400">Unused {quote.credit.from} time</dt>
            <dd className="text-emerald-400 font-black">+{quote.credit.days} days</dd>
          </div>
        )}
        {quote.pack && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-300">{quote.pack.documents} extra documents</dt>
            <dd className="text-white font-black tabular-nums">{rupees(quote.pack.priceInr)}</dd>
          </div>
        )}
        <div className="mt-2 pt-4 border-t-2 border-dashed border-white/15 flex justify-between items-baseline gap-3">
          <dt className="text-xs font-black uppercase tracking-wider text-white">Due today</dt>
          <dd className="text-4xl leading-none font-black text-white tabular-nums">{rupees(quote.today)}</dd>
        </div>
        {quote.today > 0 && (
          <p className="text-right text-xs text-gray-400">
            Includes {rupees(quote.gst)} GST ({quote.gstRatePercent}%)
          </p>
        )}
        {quote.nothingToday && (
          <p className="flex items-start justify-end gap-1.5 text-right text-xs text-gray-400" data-testid="checkout-setup-check">
            <ICONS.info className="w-3.5 h-3.5 shrink-0 mt-px text-yellow-400" />
            {SETUP_CHECK}
          </p>
        )}
        <p className="mt-2 px-3.5 py-3 rounded-xl bg-[#090a0f] border-2 border-white/15 text-[13px] text-gray-300 leading-relaxed">{quote.then}</p>
      </dl>

      {onPay && (
        <>
          <button type="button" onClick={onPay} disabled={busy || payDisabled || !quote.ready || quote.available.length === 0} className={`${BTN.primary} w-full min-h-[56px] mt-5 text-sm`}>
            {busy ? <Spinner className="w-4 h-4" colour="#ffffff" /> : <ICONS.lock className="w-4 h-4" />}
            {payLabelOf(quote, { busy, switching })}
          </button>
          <PayMethods recurring={quote.renew === "auto"} className="mt-4" />
          <p className="mt-2.5 flex items-start justify-center gap-1.5 text-center text-xs text-gray-400 leading-relaxed">
            <ICONS.shieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            Paid through Razorpay. PactDoc never sees your card or UPI details.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * How buying this takes over from the plan the account is on, as the server worked it out:
 * an upgrade starts today and turns unused time into extra days; a downgrade waits for the
 * paid time to end. Nothing is said for a first plan or more time on the same one.
 */
export function MoveNote({ quote }) {
  const { plan, change, current, credit } = quote;
  if (!plan || !current || (change !== "upgrade" && change !== "downgrade")) return null;

  if (change === "downgrade") {
    return (
      <Note tone="blue" testId="checkout-downgrade">
        You keep <strong className="text-white">{current.name}</strong> until {day(current.until)}. {plan.name} starts then, and nothing is charged today.
        {current.renews ? ` ${current.name} will not renew.` : ""}
      </Note>
    );
  }
  return (
    <Note tone="blue" testId="checkout-upgrade">
      You are on <strong className="text-white">{current.name}</strong>
      {current.until ? ` until ${day(current.until)}` : ""}. {plan.name} starts today and takes its place
      {credit ? (
        <>
          {": "}your unused {current.name} time, worth {rupees(credit.inr)}, becomes <strong className="text-white">{credit.days} extra days</strong> of {plan.name}.
        </>
      ) : (
        "."
      )}
      {current.renews ? ` ${current.name} stops renewing.` : ""}
    </Note>
  );
}
