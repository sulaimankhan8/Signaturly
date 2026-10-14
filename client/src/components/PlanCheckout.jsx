import { useState } from "react";
import toast from "react-hot-toast";
import { payFor } from "../utils/checkout";
import { day } from "../utils/billing";
import useCheckoutQuote from "../hooks/useCheckoutQuote";
import { CheckoutChoices, OrderSummary, MoveNote } from "./billing/CheckoutParts";
import { Note } from "./billing/ui";
import { ICONS } from "./billing/theme";

/**
 * Checkout in a pop-up, for buying a plan without leaving what the customer is doing (the
 * prompt shown when a send needs a bigger plan). It asks what the checkout page asks and shows
 * the same summary, from the same quote (hooks/useCheckoutQuote.js); everywhere else a plan is
 * bought on the checkout page itself (pages/billing/Checkout.jsx).
 *
 * `plans` are the plan's prices to choose between; `planId` is the one chosen to begin with.
 * `ways`, `prefer`, `paidUntil`, `seats`, `chooseSeats`, `maxSeats` and `addOns` are as in the quote.
 * A move from the plan the account is on (an upgrade's extra days, a downgrade's later start)
 * is said as the server works it out, through the quote.
 * `onDone` is called after a payment, with what payFor resolved to.
 */
export default function PlanCheckout({ open, plans, planId, ways = ["auto", "once"], prefer = "auto", paidUntil = null, seats = null, chooseSeats = false, maxSeats = 500, addOns = [], gstRatePercent, switching = false, onClose, onDone }) {
  const quote = useCheckoutQuote({ plans, planId, ways, prefer, paidUntil, seats, chooseSeats, maxSeats, addOns, gstRatePercent });
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (!open || !quote.plan) return null;
  const { plan } = quote;

  const pay = async () => {
    try {
      setBusy(true);
      setCancelled(false);
      const outcome = await payFor("plan", plan.id, quote.payArgs);
      if (outcome === "cancelled") {
        setCancelled(true);
        return;
      }
      await onDone?.(outcome);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`Get ${plan.name}`} data-testid="plan-checkout">
      {/* The choices scroll; what is charged and the button to pay stay in view beneath them */}
      <div className="bg-[#12141c] border border-white/[0.12] rounded-t-[22px] sm:rounded-[22px] max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">{paidUntil ? plan.name : `Get ${plan.name}`}</h2>
            <p className="mt-1 text-sm text-gray-400">{quote.documents}. Prices include GST.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
            <ICONS.close className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 grid gap-5 content-start">
          {cancelled && (
            <Note tone="gray" role="status">
              <strong className="text-white">Payment not completed.</strong> Nothing was charged. Press pay to try again.
            </Note>
          )}
          <MoveNote quote={quote} />
          {switching && paidUntil && (
            <Note tone="blue" testId="checkout-switching">
              Your plan stays as it is until {day(paidUntil)}. Nothing is charged today.
            </Note>
          )}
          <CheckoutChoices quote={quote} busy={busy} chooseSeats={chooseSeats} />
        </div>

        <div className="px-6 pt-4 pb-6 border-t border-white/10">
          <OrderSummary quote={quote} busy={busy} switching={switching} onPay={pay} framed={false} />
        </div>
      </div>
    </div>
  );
}
