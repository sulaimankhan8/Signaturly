import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchPlansApi, fetchUserSubscription } from "../api/billing.api";
import { includedIn } from "../config/pricingFallback";
import { payFor, rupees } from "../utils/checkout";
import { rankOf } from "../utils/billing";
import { lookOf } from "../utils/planLook";
import PlanCheckout from "./PlanCheckout";
import { ICONS } from "./billing/theme";

/**
 * Shown when a sender reaches something their plan does not include, or runs out of documents.
 * It says why, and offers the ways forward: the plan that includes what was asked for, which
 * goes on to checkout right here, or a pack of extra documents, which is one payment.
 *
 * `feature` names what was asked for ("workspaces", "api", "bulkSend", "templates.own"), so the
 * plan offered is the lowest one that has it, not always Pro. Without it, the plan one step up
 * from the sender's own is offered.
 *
 * With `outOfDocuments` it is about documents alone: every pack is offered first, and the plan
 * above as the other way. Nothing here is bought without the sender choosing it.
 *
 * Prices come from the server's price list.
 */
export const UpgradeModal = ({ isOpen, onClose, onUpgraded, reason, feature = null, outOfDocuments = false }) => {
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

  const plans = catalogue?.plans || [];
  const free = plans.find((plan) => plan.id === "free");
  const packs = catalogue?.topups || [];
  const myRank = rankOf({ tier: account?.entitlements?.tier || "free" });
  // The plans that can be bought with a button, by the month, lowest first
  const buyable = plans.filter((plan) => plan.purchasable && plan.priceInr > 0 && !plan.yearlyOf && !plan.priceIsFrom).sort((a, b) => rankOf(a) - rankOf(b) || a.priceInr - b.priceInr);
  const target = (feature ? buyable.find((plan) => includedIn(plan).features[feature]) : null) || buyable.find((plan) => rankOf(plan) > myRank) || null;
  // A sender is offered a plan only when it is a step up from their own
  const offerPlan = Boolean(target) && rankOf(target) > myRank;
  const targetPrices = target ? plans.filter((plan) => plan.purchasable && (plan.id === target.id || plan.yearlyOf === target.id)) : [];
  const usage = account?.usage;
  const look = lookOf(target);

  if (choosingPlan && target) {
    return (
      <PlanCheckout
        open
        plans={targetPrices}
        planId={target.id}
        addOns={packs}
        seats={target.perSeat ? 3 : null}
        chooseSeats={Boolean(target.perSeat)}
        maxSeats={catalogue?.maxSeats}
        gstRatePercent={catalogue?.gstRatePercent}
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
      if (outcome === "cancelled") {
        toast("Payment not completed. Nothing was charged.", { icon: "ℹ️" });
        return;
      }
      toast.success(outcome === "simulated" ? "Simulated payment applied. You can send now." : "Payment received. Your documents are added in a moment; then send again.");
      if (onUpgraded) onUpgraded();
      if (onClose) onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy("");
    }
  };

  const allowance = (plan) => (plan.documentsPerMonth === null ? "no monthly limit" : `${plan.documentsPerMonth} documents a month${plan.perSeat ? " a seat" : ""}`);
  const why = outOfDocuments
    ? `${
        usage && usage.monthlyQuota !== null ? `You have sent all ${usage.monthlyQuota} documents your plan allows this month, and have no extra documents left.` : "Your documents for this month are used up."
      } Add more with one payment: extra documents never expire, and are used only after each month's allowance.${offerPlan ? " Or move to a bigger plan." : ""}`
    : reason || (free ? `The Free plan includes ${free.documentsPerMonth} documents a month. Choose one of the options below to keep sending.` : "Choose one of the options below to keep sending.");

  // About documents: every pack. Otherwise the smallest one, beside the plan.
  const offered = outOfDocuments ? packs : packs.slice(0, 1);
  const planButton = (first) => (
    <button
      type="button"
      onClick={() => setChoosingPlan(true)}
      disabled={Boolean(busy)}
      className={`w-full flex justify-between items-center gap-3 min-h-[52px] px-4 rounded-xl text-sm font-bold text-left disabled:opacity-40 transition-colors ${first ? `${look.solid} hover:brightness-110 text-white` : "bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-100"}`}
    >
      <span>
        {outOfDocuments ? "Move to " : ""}
        {target.name}: {allowance(target)}
      </span>
      <span className="whitespace-nowrap">
        {rupees(target.priceInr)} a {target.perSeat ? "seat a " : ""}
        {target.interval}
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={outOfDocuments ? "Out of documents" : "Upgrade"} data-testid={outOfDocuments ? "out-of-documents" : undefined}>
      <div className="bg-[#12141c] border border-white/[0.12] rounded-[22px] max-w-md w-full p-6 grid gap-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`w-10 h-10 grid place-items-center rounded-xl ${outOfDocuments ? "bg-amber-400/15 text-amber-300" : "bg-violet-400/15 text-violet-300"}`} aria-hidden="true">
              {outOfDocuments ? <ICONS.doc className="w-5 h-5" /> : <ICONS.bolt className="w-5 h-5" />}
            </span>
            <h2 className="font-display text-lg font-bold text-white">{outOfDocuments ? "You have used this month's documents" : `This needs ${target ? `the ${target.name} plan` : "a bigger plan"}`}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
            <ICONS.close className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed">{why}</p>

        {catalogue ? (
          <div className="grid gap-2">
            {!outOfDocuments && offerPlan && planButton(true)}
            {offered.map((pack, index) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => buy("topup", pack.id)}
                disabled={Boolean(busy)}
                className={`w-full flex justify-between items-center gap-3 min-h-[52px] px-4 rounded-xl text-sm font-bold disabled:opacity-40 transition-colors ${
                  outOfDocuments && index === 0 ? "bg-rose-600 hover:bg-rose-500 text-white" : "bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-100"
                }`}
              >
                <span>{pack.documents} extra documents, one payment</span>
                <span>{rupees(pack.priceInr)}</span>
              </button>
            ))}
            {outOfDocuments && offerPlan && planButton(false)}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Loading prices…</p>
        )}

        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            navigate("/billing/plans");
          }}
          className="justify-self-start text-sm text-gray-400 underline underline-offset-2 hover:text-white"
        >
          Compare all plans
        </button>
      </div>
    </div>
  );
};
