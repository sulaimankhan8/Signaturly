import { includedIn, people } from "../../config/pricingFallback";
import { offersOf } from "../../utils/plans";
import { lookOf } from "../../utils/planLook";

const YES = (
  <span className="inline-grid place-items-center w-6 h-6 rounded-md border-2 border-black bg-emerald-500 text-black shadow-[2px_2px_0px_0px_#000]" aria-label="Yes">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </span>
);
const NO = (
  <span className="text-gray-600 font-black" aria-label="Not included">
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
  const shade = (index) => (index === mineAt ? "bg-yellow-400/[0.07]" : "");

  return (
    <section aria-labelledby="compare-heading" className="bg-[#13151f] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] overflow-hidden" data-testid="comparison">
      <h2 id="compare-heading" className="px-6 pt-6 pb-3 text-xl font-black uppercase tracking-tight text-white">
        Compare every feature
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-[34%] px-6 py-3 text-left text-[11px] font-black uppercase tracking-wider text-gray-400 bg-[#090a0f] border-y-2 border-white/10">
                Feature
              </th>
              {offers.map(({ plan }, index) => (
                <th key={plan.id} scope="col" className={`px-3 py-3 text-center text-sm font-black uppercase tracking-wide bg-[#090a0f] border-y-2 border-white/10 ${lookOf(plan).heading}`}>
                  {plan.name}
                  {index === mineAt && <span className="ml-1.5 align-middle px-1.5 py-0.5 rounded border-2 border-black bg-yellow-400 text-black text-[9px] font-black">YOURS</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-200">
            {groupsOf(offers).map(([group, rows]) => [
              <tr key={group}>
                <td colSpan={offers.length + 1} className="px-6 pt-5 pb-1.5 text-[11px] font-black uppercase tracking-wider text-red-400">
                  {group}
                </td>
              </tr>,
              ...rows.map(([feature, ...cells]) => (
                <tr key={feature}>
                  <th scope="row" className="px-6 py-2.5 text-left font-medium border-t border-white/[0.06]">
                    {feature}
                  </th>
                  {cells.map((cell, index) => (
                    <td key={index} className={`px-3 py-2.5 text-center font-bold border-t border-white/[0.06] ${shade(index)}`}>
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
      <h2 id="faq-heading" className="text-xl font-black uppercase tracking-tight text-white">
        Questions about billing
      </h2>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {QUESTIONS.map(([question, answer], index) => (
          <details key={question} open={index < 2} className="group bg-[#13151f] border-2 border-white/20 rounded-xl px-5 py-4 shadow-[3px_3px_0px_0px_#000] open:border-white/30">
            <summary className="cursor-pointer list-none flex items-start justify-between gap-3 font-bold text-white [&::-webkit-details-marker]:hidden">
              {question}
              <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md border-2 border-black bg-red-600 text-white font-black leading-none transition-transform group-open:rotate-45 group-open:bg-yellow-400 group-open:text-black" aria-hidden="true">
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
