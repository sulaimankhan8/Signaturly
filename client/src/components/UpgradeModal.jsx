import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchPlansApi, fetchUserSubscription } from "../api/billing.api";
import { payFor, rupees } from "../utils/checkout";
import PlanCheckout from "./PlanCheckout";

/**
 * Shown when a sender reaches something their plan does not include, or runs out of documents.
 * It says why, and offers the ways forward: a bigger plan, which goes on to the step that asks
 * how to pay for it, or a pack of extra documents, which is one payment.
 *
 * With `outOfDocuments` it is about documents alone: every pack is offered, and a plan only to
 * a sender on Free. Nothing here is bought without the sender choosing it.
 *
 * Prices come from the server's price list.
 */
export const UpgradeModal = ({ isOpen, onClose, onUpgraded, reason, outOfDocuments = false }) => {
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState(null);
  // The sender's own plan and usage, when they can be read
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState("");
  const [choosingPlan, setChoosingPlan] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchUserSubscription()
      .then((data) => {
        setAccount(data);
        setCatalogue(data.catalogue);
      })
      .catch(() =>
        fetchPlansApi()
          .then(setCatalogue)
          .catch(() => setCatalogue(null))
      );
  }, [isOpen]);

  if (!isOpen) return null;

  const pro = catalogue?.plans.find((plan) => plan.id === "pro_monthly" && plan.purchasable);
  const free = catalogue?.plans.find((plan) => plan.id === "free");
  const packs = catalogue?.topups || [];
  // Pro by the month and by the year, for the checkout step to offer
  const proPlans = (catalogue?.plans || []).filter((plan) => plan.tier === "pro" && plan.purchasable && !plan.perSeat);
  // A sender already on a paid plan is not offered the same plan again
  const offerPlan = Boolean(pro) && (!account || account.entitlements?.tier === "free");
  const usage = account?.usage;

  if (choosingPlan && pro) {
    return (
      <PlanCheckout
        open
        plans={proPlans.length ? proPlans : [pro]}
        planId={pro.id}
        addOns={packs}
        onClose={() => setChoosingPlan(false)}
        onDone={() => {
          setChoosingPlan(false);
          if (onUpgraded) onUpgraded();
          if (onClose) onClose();
        }}
      />
    );
  }

  const buy = async (kind, item) => {
    try {
      setBusy(`${kind}:${item}`);
      const outcome = await payFor(kind, item, { stay: true });
      if (outcome === "cancelled") return;
      toast.success(outcome === "simulated" ? "Simulated payment applied. You can send now." : "Payment received. Your documents are added in a moment; then send again.");
      if (onUpgraded) onUpgraded();
      if (onClose) onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy("");
    }
  };

  const why = outOfDocuments
    ? `${
        usage && usage.monthlyQuota !== null ? `You have sent all ${usage.monthlyQuota} documents your plan allows this month, and have no extra documents left.` : "Your documents for this month are used up."
      } Add more with one payment: extra documents never expire, and are used only after each month's allowance.${offerPlan ? " Or move to a bigger plan." : ""}`
    : reason || (free ? `The Free plan includes ${free.documentsPerMonth} documents a month. Choose one of the options below to keep sending.` : "Choose one of the options below to keep sending.");

  // About documents: every pack. Otherwise the smallest one, beside the plan.
  const offered = outOfDocuments ? packs : packs.slice(0, 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={outOfDocuments ? "Out of documents" : "Upgrade"} data-testid={outOfDocuments ? "out-of-documents" : undefined}>
      <div className="bg-[#12141c] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-white">{outOfDocuments ? "You have used this month's documents" : "This needs a bigger plan"}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed">{why}</p>

        {catalogue ? (
          <div className="space-y-2">
            {!outOfDocuments && offerPlan && (
              <button
                onClick={() => setChoosingPlan(true)}
                disabled={Boolean(busy)}
                className="w-full flex justify-between items-center px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold"
              >
                <span>Pro: {pro.documentsPerMonth === null ? "no monthly limit" : `${pro.documentsPerMonth} documents a month`}</span>
                <span>{rupees(pro.priceInr)} a month</span>
              </button>
            )}
            {offered.map((pack, index) => (
              <button
                key={pack.id}
                onClick={() => buy("topup", pack.id)}
                disabled={Boolean(busy)}
                className={`w-full flex justify-between items-center px-4 py-3 disabled:opacity-40 rounded-xl text-sm font-bold ${
                  outOfDocuments && index === 0 ? "bg-red-600 hover:bg-red-500 text-white" : "bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200"
                }`}
              >
                <span>{pack.documents} extra documents, one payment</span>
                <span>{rupees(pack.priceInr)}</span>
              </button>
            ))}
            {outOfDocuments && offerPlan && (
              <button
                onClick={() => setChoosingPlan(true)}
                disabled={Boolean(busy)}
                className="w-full flex justify-between items-center px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-gray-200 rounded-xl text-sm font-bold"
              >
                <span>Move to Pro: {pro.documentsPerMonth === null ? "no monthly limit" : `${pro.documentsPerMonth} documents a month`}</span>
                <span>{rupees(pro.priceInr)} a month</span>
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Loading prices...</p>
        )}

        <button
          onClick={() => {
            if (onClose) onClose();
            navigate("/billing#plans");
          }}
          className="text-xs text-gray-400 underline hover:text-white"
        >
          Compare all plans
        </button>
      </div>
    </div>
  );
};
