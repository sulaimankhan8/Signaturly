import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchPlansApi } from "../api/billing.api";
import { payFor, rupees } from "../utils/checkout";

/**
 * Shown when a sender reaches something their plan does not include, or runs out of documents.
 * It says why, and offers the two ways forward: Pro, or a pack of extra documents.
 * Prices come from the server's price list.
 */
export const UpgradeModal = ({ isOpen, onClose, onUpgraded, reason }) => {
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!isOpen || catalogue) return;
    fetchPlansApi()
      .then(setCatalogue)
      .catch(() => setCatalogue(null));
  }, [isOpen, catalogue]);

  if (!isOpen) return null;

  const pro = catalogue?.plans.find((plan) => plan.id === "pro_monthly");
  const free = catalogue?.plans.find((plan) => plan.id === "free");
  const smallestPack = catalogue?.topups[0];

  const buy = async (kind, item) => {
    try {
      setBusy(`${kind}:${item}`);
      const outcome = await payFor(kind, item);
      if (outcome === "cancelled") return;
      toast.success(outcome === "simulated" ? "Simulated payment applied." : "Payment received. Your account will update in a moment.");
      if (onUpgraded) onUpgraded();
      if (onClose) onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Upgrade">
      <div className="bg-[#12141c] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-white">This needs a bigger plan</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed">
          {reason || (free ? `The Free plan includes ${free.documentsPerMonth} documents a month. Choose one of the options below to keep sending.` : "Choose one of the options below to keep sending.")}
        </p>

        {catalogue ? (
          <div className="space-y-2">
            <button
              onClick={() => buy("plan", "pro_monthly")}
              disabled={Boolean(busy)}
              className="w-full flex justify-between items-center px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold"
            >
              <span>Pro: {pro.documentsPerMonth} documents a month</span>
              <span>{rupees(pro.priceInr)} a month</span>
            </button>
            <button
              onClick={() => buy("topup", smallestPack.id)}
              disabled={Boolean(busy)}
              className="w-full flex justify-between items-center px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-gray-200 rounded-xl text-sm font-bold"
            >
              <span>{smallestPack.documents} extra documents</span>
              <span>{rupees(smallestPack.priceInr)}</span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Loading prices...</p>
        )}

        <button
          onClick={() => {
            if (onClose) onClose();
            navigate("/pricing");
          }}
          className="text-xs text-gray-400 underline hover:text-white"
        >
          Compare all plans
        </button>
      </div>
    </div>
  );
};
