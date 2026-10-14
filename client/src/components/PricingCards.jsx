import { useState } from "react";
import { Link } from "react-router-dom";
import PlanCard from "./PlanCard";
import { BUTTONS, lookOf, familyOf } from "../utils/planLook";
import PeriodSwitch from "./PeriodSwitch";
import ContactSales from "./ContactSales";
import { offersOf, offerOf, recordFor, bestSaving, savingSaid, savingOn, anyYearly, periodSaid } from "../utils/plans";
import { checkoutPath, day, rankOf } from "../utils/billing";

// How a plan may be bought. A price list that does not say sells it both ways.
const soldAs = (plan) => plan.billing || { subscription: Boolean(plan.purchasable), prepaid: Boolean(plan.purchasable) };

const quiet = BUTTONS.quiet;
const note = "text-center text-xs text-gray-400 min-h-[2.25rem] flex items-center justify-center leading-snug";

/**
 * The plans, with the monthly or yearly switch above them: on the landing page, the pricing
 * page and the Plans tab of Billing, for a visitor and for someone signed in alike. Each plan
 * is the same card everywhere (components/PlanCard.jsx), with one thing to do beneath it.
 *
 * The list is the server's (`catalogue`) when the page has it, and otherwise the copy kept
 * with the client.
 *
 * Without `account` each button leads to checkout for the plan and period chosen, through
 * creating an account first for a visitor.
 *
 * With `account` the cards are the account's own: its plan is marked, and each button opens
 * checkout for that plan, where how it is paid for is chosen.
 *   currentPlanId   what the account is on now: a plan, at one of its two prices
 *   renews          the account's plan renews by itself
 *   paidUntil       when the time it has paid for ends
 *   recommended     the plan family we point the account to ("pro", "business"), if any
 *   held            nothing can be bought just now (a purchase is under way, or billing is off)
 *   onChoose(record)  opens checkout for a plan at one of its prices
 *   onDowngrade()   moves the account to Free when its paid time ends (turns auto-renew off)
 *
 * `large` is the roomier card of the landing page. `defaultYearly` starts the switch on yearly.
 */
export default function PricingCards({ catalogue, user = null, account = null, large = false, defaultYearly = false }) {
  const offers = offersOf(catalogue?.plans);
  const mine = account ? offerOf(offers, account.currentPlanId) : null;
  const current = mine ? (mine.yearly?.id === account.currentPlanId ? mine.yearly : mine.plan) : null;
  const [yearly, setYearly] = useState(current?.interval ? current.interval === "year" : defaultYearly && anyYearly(offers));
  // The plan the "Contact sales" form is open for
  const [asking, setAsking] = useState(null);

  const period = yearly ? "year" : "month";
  const afterSignIn = (path) => (user ? path : `/register?next=${encodeURIComponent(path)}`);
  const myRank = mine ? rankOf(mine.plan) : 0;
  const onPaidPlan = Boolean(mine) && mine.plan.priceInr > 0;

  return (
    <div data-testid="billing-plans">
      {anyYearly(offers) && (
        <div className={`flex justify-center ${large ? "mb-12" : "mb-10"}`}>
          <PeriodSwitch yearly={yearly} onChange={setYearly} saving={savingSaid(bestSaving(offers))} />
        </div>
      )}

      <ul className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 gap-y-9 pt-3 items-stretch ${large ? "max-w-7xl mx-auto text-left" : ""}`}>
        {offers.map((offer) => {
          const { plan } = offer;
          const own = Boolean(mine) && offer === mine;
          const record = recordFor(offer, period);
          const ways = soldAs(record);
          const buyable = record.purchasable && (ways.subscription || ways.prepaid);
          // The account's own plan at its other price: the same plan, paid for differently
          const other = own && current ? (current === offer.plan ? offer.yearly : offer.plan) : null;
          const otherWays = other ? soldAs(other) : null;
          const canSwitch = Boolean(other?.purchasable) && (account?.renews ? otherWays.subscription : otherWays.subscription || otherWays.prepaid);
          const saves = other && other === offer.yearly ? savingSaid(savingOn(offer)) : "";
          const button = lookOf(plan).button;
          const recommended = !own && Boolean(account?.recommended) && familyOf(plan.id) === account.recommended;
          const verb = !account ? "Get" : rankOf(plan) > myRank ? "Upgrade to" : "Switch to";

          return (
            <PlanCard key={plan.id} offer={offer} period={period} current={own} recommended={recommended} large={large} testId={`plan-${plan.id.replace(/_monthly$/, "")}`}>
              {own ? (
                <>
                  {canSwitch ? (
                    <button type="button" className={quiet} disabled={account.held} onClick={() => account.onChoose(other)} aria-label={`Switch ${plan.name} to ${periodSaid(other).toLowerCase()} billing`}>
                      Switch to {periodSaid(other).toLowerCase()}
                      {saves ? ` · ${saves}` : ""}
                    </button>
                  ) : (
                    <button type="button" disabled className={`${quiet} opacity-60 cursor-default`}>
                      Current plan
                    </button>
                  )}
                  <p className={note}>
                    {plan.priceInr === 0
                      ? "Where an account stays when no paid plan is running."
                      : account.renews && account.paidUntil
                        ? `Renews automatically on ${day(account.paidUntil)}${periodSaid(current) ? `, ${periodSaid(current).toLowerCase()}` : ""}.`
                        : account.paidUntil
                          ? `Paid until ${day(account.paidUntil)}.`
                          : "This is the plan you are on."}
                  </p>
                </>
              ) : plan.priceInr === 0 ? (
                account ? (
                  account.renews && onPaidPlan ? (
                    <>
                      <button type="button" className={quiet} disabled={account.held} onClick={account.onDowngrade}>
                        Downgrade to Free
                      </button>
                      <p className={note}>Takes effect {account.paidUntil ? `on ${day(account.paidUntil)}` : "when your paid time ends"}. Your documents are kept.</p>
                    </>
                  ) : (
                    <>
                      <button type="button" disabled className={`${quiet} opacity-50 cursor-default`}>
                        Free plan
                      </button>
                      <p className={note}>{onPaidPlan && account.paidUntil ? `Your plan moves to Free after ${day(account.paidUntil)} unless you renew.` : "Where an account returns when a paid plan ends."}</p>
                    </>
                  )
                ) : (
                  <>
                    <Link to={user ? "/dashboard" : "/register"} className={quiet}>
                      {user ? "Go to dashboard" : "Start free"}
                    </Link>
                    <p className={note}>Free forever · No card needed</p>
                  </>
                )
              ) : buyable ? (
                <>
                  {account ? (
                    // How it is paid for, as a subscription or for one period, is asked at checkout
                    <button type="button" className={button} disabled={account.held} onClick={() => account.onChoose(record)}>
                      {verb} {plan.name}
                    </button>
                  ) : (
                    <Link to={afterSignIn(checkoutPath(record.id))} className={button}>
                      {verb} {plan.name}
                    </Link>
                  )}
                  <p className={note}>
                    {!onPaidPlan
                      ? `Auto-renew or pay for one ${record.interval}: you choose at checkout.`
                      : rankOf(plan) >= myRank
                        ? "Starts today. Unused time on your plan becomes extra days on this one."
                        : "Starts when the time you have paid for ends. You keep your plan until then."}
                  </p>
                </>
              ) : (
                // No price to pay with a button: it is agreed with us first
                <>
                  <button type="button" onClick={() => setAsking(plan)} className={button}>
                    Contact sales
                  </button>
                  <p className={note}>Tell us what you need. We reply within one working day.</p>
                </>
              )}
            </PlanCard>
          );
        })}
      </ul>

      {asking && <ContactSales open plan={asking} user={user} onClose={() => setAsking(null)} />}
    </div>
  );
}
