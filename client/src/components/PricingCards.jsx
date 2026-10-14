import { useState } from "react";
import { Link } from "react-router-dom";
import PlanCard from "./PlanCard";
import PeriodSwitch from "./PeriodSwitch";
import ContactSales from "./ContactSales";
import { offersOf, offerOf, recordFor, bestSaving, savingSaid, savingOn, anyYearly, periodSaid } from "../utils/plans";

// How a plan may be bought. A price list that does not say sells it both ways.
const soldAs = (plan) => plan.billing || { subscription: Boolean(plan.purchasable), prepaid: Boolean(plan.purchasable) };

const loud = "block w-full text-center py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:pointer-events-none text-black font-black uppercase tracking-wider rounded-xl text-xs border-2 border-black shadow-[4px_4px_0px_0px_#ef4444] transition-all";
const quiet = "block w-full text-center py-3 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none text-white font-black uppercase tracking-wider rounded-xl text-xs border-2 border-white/30 transition";
const note = "text-center text-[11px] text-gray-400 min-h-[2.25rem] flex items-center justify-center leading-snug";

/**
 * The plans, with the monthly or yearly switch above them: on the landing page and on the
 * plans and billing page, for a visitor and for someone signed in alike. Each plan is the same
 * card everywhere (components/PlanCard.jsx), with one thing to do beneath it.
 *
 * The list is the server's (`catalogue`) when the page has it, and otherwise the copy kept
 * with the client.
 *
 * Without `account` the cards lead on: a visitor creates an account first, and someone signed
 * in goes to the plans and billing page, straight to checkout for the plan and period chosen.
 *
 * With `account` the cards are the account's own: its plan is marked, and "Get ..." opens the
 * checkout step, which is where subscription or prepaid is chosen.
 *   currentPlanId   what the account is on now: a plan, at one of its two prices
 *   renews          the account's plan renews by itself. It has to be turned off before another
 *                   plan is bought, so the buttons are held back and the reason is given. The one
 *                   move that needs no turning off is to the same plan's other price.
 *   manageable      there is something to do about the present plan elsewhere on the page
 *   held            nothing can be bought just now (a purchase is under way, or billing is off)
 *   onChoose(record, way)   opens the checkout step for a plan at one of its prices
 *
 * `large` is the roomier card of the landing page.
 */
export default function PricingCards({ catalogue, user = null, account = null, large = false }) {
  const offers = offersOf(catalogue?.plans);
  const mine = account ? offerOf(offers, account.currentPlanId) : null;
  const current = mine ? (mine.yearly?.id === account.currentPlanId ? mine.yearly : mine.plan) : null;
  const [yearly, setYearly] = useState(current?.interval === "year");
  // The plan the "Contact sales" form is open for
  const [asking, setAsking] = useState(null);

  const period = yearly ? "year" : "month";
  const afterSignIn = (path) => (user ? path : `/register?next=${encodeURIComponent(path)}`);

  return (
    <div data-testid="billing-plans">
      {anyYearly(offers) && (
        <div className={`flex justify-center ${large ? "mb-10" : "mb-6"}`}>
          <PeriodSwitch yearly={yearly} onChange={setYearly} saving={savingSaid(bestSaving(offers))} />
        </div>
      )}

      {account?.renews && (
        <p className="mb-4 px-4 py-3 rounded-xl border-2 border-amber-400/40 bg-amber-400/10 text-amber-100 text-xs" role="status">
          Your plan renews automatically. To move to another plan, turn off auto-renew above first; you keep the time you have paid for.
        </p>
      )}

      <ul className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 ${large ? "gap-6 max-w-7xl mx-auto text-left" : "gap-4"} items-stretch`}>
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
          const button = plan.highlight ? loud : quiet;

          return (
            <PlanCard key={plan.id} offer={offer} period={period} current={own} large={large} testId={`plan-${plan.id.replace(/_monthly$/, "")}`}>
              {own ? (
                <>
                  {canSwitch ? (
                    <button type="button" className={quiet} disabled={account.held} onClick={() => account.onChoose(other, "auto")} aria-label={`Switch ${plan.name} to ${periodSaid(other).toLowerCase()} billing`}>
                      Switch to {periodSaid(other).toLowerCase()}
                      {saves ? ` · ${saves}` : ""}
                    </button>
                  ) : (
                    <button type="button" disabled className={`${quiet} opacity-60 cursor-default`}>
                      Current plan
                    </button>
                  )}
                  <p className={note}>
                    This is the plan you are on{periodSaid(current) ? `, paid ${periodSaid(current).toLowerCase()}` : ""}.{account.manageable ? " Manage it above." : ""}
                  </p>
                </>
              ) : plan.priceInr === 0 ? (
                account ? (
                  <>
                    <button type="button" disabled className={`${quiet} opacity-40 cursor-default`}>
                      Free plan
                    </button>
                    <p className={note}>Where an account returns when a paid plan ends. Your documents are kept.</p>
                  </>
                ) : (
                  <>
                    <Link to={user ? "/dashboard" : "/register"} className={quiet}>
                      {user ? "Go to dashboard" : "Start free"}
                    </Link>
                    <p className={note}>Free forever · No credit card required</p>
                  </>
                )
              ) : buyable ? (
                <>
                  {account ? (
                    // How it is paid for, as a subscription or for one period, is asked at the next step
                    <button type="button" className={button} disabled={account.held || account.renews} onClick={() => account.onChoose(record, ways.subscription ? "auto" : "once")}>
                      Get {plan.name}
                    </button>
                  ) : (
                    <Link to={afterSignIn(`/billing?plan=${record.id}`)} className={button}>
                      Get {plan.name}
                    </Link>
                  )}
                  <p className={note}>Subscribe and renew automatically, or pay for one {record.interval} at a time</p>
                </>
              ) : (
                // No price to pay with a button: it is agreed with us first
                <>
                  <button type="button" onClick={() => setAsking(plan)} className={quiet}>
                    Contact sales
                  </button>
                  <p className={note}>Tell us what you need and we will write to you</p>
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
