import { useBilling } from "./useBilling";
import PricingCards from "../../components/PricingCards";
import PlanComparison, { BillingFaq } from "../../components/billing/PlanComparison";
import { recommendedFamily } from "../../utils/billing";

/**
 * Billing's Plans tab: every plan with the account's own marked, the one we would point it to,
 * and each button leading to checkout for that plan.
 */
export default function Plans() {
  const { user, catalogue, mine, held, goCheckout, stopRenewing } = useBilling();

  return (
    <div className="grid gap-14">
      <div>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white">Pick the plan that fits how much you send</h2>
          <p className="mt-2 text-gray-400 leading-relaxed">A document is one PDF sent for signature, however many people sign it. No charge per signer. Prices include GST.</p>
        </div>
        <PricingCards
          catalogue={catalogue}
          user={user}
          account={{
            currentPlanId: mine.planId,
            renews: mine.renewing,
            paidUntil: mine.renewal.nextChargeOn || mine.renewal.endsOn || null,
            recommended: recommendedFamily(mine),
            held,
            onChoose: (record) => goCheckout(record),
            onDowngrade: stopRenewing,
          }}
        />
      </div>
      <PlanComparison catalogue={catalogue} currentPlanId={mine.planId} />
      <BillingFaq />
    </div>
  );
}
