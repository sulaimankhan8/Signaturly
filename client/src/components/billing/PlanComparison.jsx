import { includedIn, people } from "../../config/pricingFallback";
import { offersOf } from "../../utils/plans";
import { lookOf } from "../../utils/planLook";

const YES = <span className="text-emerald-400 font-bold">Yes</span>;
const NO = (
  <span className="text-gray-500" aria-label="Not included">
    —
  </span>
);

// What each plan includes, grouped. The rows an admin can change for a plan (its allowance,
// saving templates, bulk send, workspaces, the API) are read from the price list; the others
// follow the plan's level, and must stay true to services/entitlements.service.js on the server.
const groupsOf = (offers) => {
  const columns = offers.map(({ plan }) => ({ plan, ...includedIn(plan) }));
  const each = (say) => columns.map(say);
  const has = (feature) => each(({ features }) => (features[feature] ? YES : NO));
  return [
    [
      "Sending",
      [
        ["Documents a month", ...each(({ plan }) => (plan.priceIsFrom ? "Agreed with you" : plan.documentsPerMonth ? `${plan.documentsPerMonth}${plan.perSeat ? " a seat, pooled" : ""}` : "No limit"))],
        ["Extra documents when you run out", ...each(() => YES)],
        ["Sealed PDF with a signing record", ...each(() => YES)],
        ["Signing in English and Hindi", ...each(() => YES)],
        ["Bulk send", ...each(({ features, limits }) => (features.bulkSend ? `${people(limits.bulkSendMax)} at a time` : NO))],
      ],
    ],
    [
      "Templates & branding",
      [
        ["Ready-made templates", ...each(({ plan }) => (plan.tier === "free" ? "Starter pack" : plan.tier === "enterprise" ? "Every pack" : "Every Pro pack"))],
        ["Save your own templates", ...has("templates.own")],
        ["“Signed with PactDoc” line on your documents", ...each(({ plan }) => (plan.tier === "free" ? "Shown" : "Removed"))],
        ["Your name and logo for signers", ...has("workspaces")],
      ],
    ],
    [
      "Teams & security",
      [
        ["Team workspaces, roles and invitations", ...has("workspaces")],
        ["API keys, webhooks and embedded signing", ...has("api")],
        ["Single sign-on", ...each(({ plan }) => (plan.tier === "enterprise" ? YES : NO))],
      ],
    ],
  ];
};

/**
 * Every feature, plan by plan, in one table. `currentPlanId` shades the account's own column.
 */
export default function PlanComparison({ catalogue, currentPlanId = null }) {
  const offers = offersOf(catalogue?.plans);
  const mineAt = offers.findIndex(({ plan, yearly }) => plan.id === currentPlanId || yearly?.id === currentPlanId);
  const shade = (index) => (index === mineAt ? "bg-amber-400/[0.06]" : "");

  return (
    <section aria-labelledby="compare-heading" className="bg-[#12141c] border border-white/[0.08] rounded-[18px] overflow-hidden" data-testid="comparison">
      <h2 id="compare-heading" className="px-6 pt-6 pb-2 font-display text-[22px] font-bold text-white">
        Compare every feature
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-[34%] px-6 py-3.5 text-left text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
                Feature
              </th>
              {offers.map(({ plan }, index) => (
                <th key={plan.id} scope="col" className={`px-3 py-3.5 text-center font-bold ${lookOf(plan).heading} ${shade(index)}`}>
                  {plan.name}
                  {index === mineAt ? " · yours" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-200">
            {groupsOf(offers).map(([group, rows]) => [
              <tr key={group}>
                <td colSpan={offers.length + 1} className="px-6 pt-4 pb-1.5 text-xs font-bold uppercase tracking-[0.06em] text-rose-300 border-t border-white/[0.06]">
                  {group}
                </td>
              </tr>,
              ...rows.map(([feature, ...cells]) => (
                <tr key={feature}>
                  <th scope="row" className="px-6 py-3 text-left font-medium border-t border-white/[0.05]">
                    {feature}
                  </th>
                  {cells.map((cell, index) => (
                    <td key={index} className={`px-3 py-3 text-center border-t border-white/[0.05] ${shade(index)}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const QUESTIONS = [
  ["What counts as a document?", "One PDF sent for signature, however many people sign it. There is no charge per signer."],
  ["Auto-renew or pay once?", "Auto-renew charges the UPI or card you approve each month or year until you turn it off. Pay once covers one month or year and then stops."],
  ["Can I change or cancel my plan?", "Yes. Turn auto-renew off any time from Billing: you keep the plan until the end of what you have paid for, and nothing more is charged."],
  ["What if I run out of documents?", "Buy extra documents with one payment, on any plan. They are used after the monthly allowance and never expire."],
  ["Do prices include GST?", "Yes, every price includes GST. Add your GSTIN at checkout or under Invoices so it is printed on your tax invoice."],
  ["How do I pay?", "By UPI, debit or credit card, or netbanking, through Razorpay. PactDoc never sees your card or UPI details."],
];

export function BillingFaq() {
  return (
    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="font-display text-[22px] font-bold text-white">
        Questions about billing
      </h2>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {QUESTIONS.map(([question, answer], index) => (
          <details key={question} open={index < 2} className="group bg-[#12141c] border border-white/[0.08] rounded-[14px] px-5 py-4">
            <summary className="cursor-pointer list-none flex items-start justify-between gap-3 font-bold text-white [&::-webkit-details-marker]:hidden">
              {question}
              <span className="text-gray-400 transition-transform group-open:rotate-45 text-lg leading-none" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
