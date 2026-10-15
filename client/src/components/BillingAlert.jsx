import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSubscription } from "../hooks/useBillingAccount";
import { checkoutPath, day, daysUntil } from "../utils/billing";
import { ICONS } from "./billing/theme";

/**
 * One line under the navbar, on every page of the app, when something about the plan needs the
 * customer before it costs them their plan:
 *   an automatic payment that did not go through     (red; the plan stays on for a few days)
 *   a plan paid for once that has ended              (red)
 *   a plan paid for once that ends within a week     (amber; can be put away until it changes)
 * Billing and the pricing page say all this themselves, so it is not shown there.
 */
const dismissedKey = (kind, date) => `pactdoc:billing-alert:${kind}:${date || ""}`;
const readDismissed = (key) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

export default function BillingAlert() {
  const data = useSubscription();
  const { pathname } = useLocation();
  const [, setTick] = useState(0);

  if (!data || pathname.startsWith("/billing") || pathname.startsWith("/pricing")) return null;
  const renewal = data.renewal;
  if (!renewal || renewal.mode === "none") return null;

  const planId = data.entitlements?.plan || data.subscription?.plan;
  const planName = data.catalogue?.plans?.find((plan) => plan.id === planId)?.name || data.availablePlans?.[planId]?.name || "paid";

  let alert = null;
  if (renewal.mode === "auto" && renewal.overdue) {
    alert = {
      kind: "overdue",
      tone: "red",
      text: `The automatic payment for your ${planName} plan did not go through. Razorpay will try again, and your plan stays on meanwhile${data.subscription?.gracePeriodEnd ? `, until ${day(data.subscription.gracePeriodEnd)}` : ""}. Pay now to keep it without a break.`,
      to: checkoutPath(planId, { renew: "auto" }),
      cta: "Pay now",
    };
  } else if (renewal.mode === "once" && renewal.overdue) {
    alert = { kind: "ended", tone: "red", text: `Your ${planName} plan ended on ${day(renewal.endsOn)}. Renew it to keep its documents and features.`, to: checkoutPath(planId, { renew: "auto" }), cta: `Renew ${planName}` };
  } else if (renewal.mode === "once" && renewal.endsOn && daysUntil(renewal.endsOn) <= 7) {
    const left = daysUntil(renewal.endsOn);
    alert = {
      kind: "ending",
      tone: "amber",
      text: `Your ${planName} plan ends ${left === 0 ? "today" : left === 1 ? "tomorrow" : `in ${left} days`}, on ${day(renewal.endsOn)}. Turn on auto-renew to keep it without a break; nothing is charged until then.`,
      to: checkoutPath(planId, { renew: "auto" }),
      cta: "Turn on auto-renew",
      dismissible: true,
      date: renewal.endsOn,
    };
  }
  if (!alert) return null;

  const key = dismissedKey(alert.kind, alert.date);
  if (alert.dismissible && readDismissed(key)) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Without storage it comes back on the next page; that is all
    }
    setTick((n) => n + 1);
  };

  const red = alert.tone === "red";
  return (
    <div role={red ? "alert" : "status"} className={`border-b-2 ${red ? "bg-red-950/60 border-red-500/70" : "bg-amber-950/50 border-amber-500/60"}`} data-testid="billing-alert">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className={`w-7 h-7 shrink-0 grid place-items-center rounded-lg border-2 border-black ${red ? "bg-red-600 text-white" : "bg-yellow-400 text-black"}`} aria-hidden="true">
          <ICONS.alert className="w-4 h-4" />
        </span>
        <p className={`flex-1 min-w-[240px] font-medium ${red ? "text-red-100" : "text-amber-50"}`}>{alert.text}</p>
        <Link
          to={alert.to}
          className={`inline-flex items-center min-h-[36px] px-3.5 rounded-lg border-2 border-black text-[11px] font-black uppercase tracking-wider transition-all hover:-translate-y-0.5 ${
            red ? "bg-red-600 hover:bg-red-500 text-white shadow-[2px_2px_0px_0px_#facc15]" : "bg-yellow-400 hover:bg-yellow-300 text-black shadow-[2px_2px_0px_0px_#ef4444]"
          }`}
        >
          {alert.cta}
        </Link>
        {alert.dismissible && (
          <button type="button" onClick={dismiss} aria-label="Hide this message" className="w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
            <ICONS.close className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
