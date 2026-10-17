import React from "react";

export default function PlanNoticeBanner({
  isLoading,
  subData,
  user,
  isPlanBannerDismissed,
  handleDismissPlanBanner,
  navigate,
}) {
  if (isLoading && !subData) {
    return null;
  }

  const subscription = subData?.subscription || user?.subscription;
  if (!subscription) {
    return null;
  }

  const plan = subscription?.plan || "free";
  const status = subscription?.status || "active";
  const envelopesUsed = subData?.quota?.envelopesUsedThisMonth || 0;
  const monthlyLimit = subData?.quota?.monthlyLimit || 5;
  const extraDocuments = subData?.usage?.extraDocuments || 0;
  const percentage = Math.min(100, Math.round((envelopesUsed / monthlyLimit) * 100));

  const userId = user?._id || user?.id || "guest";
  const isDismissed =
    isPlanBannerDismissed ||
    (plan !== "free" && localStorage.getItem(`dismissed_plan_banner_${userId}`) === plan);

  // 1. Past Due Grace Period Alert Banner
  if (status === "past_due") {
    const graceEnd = subscription?.gracePeriodEnd
      ? new Date(subscription.gracePeriodEnd).toLocaleDateString()
      : null;
    const autoPay = subData?.renewal?.mode === "auto";
    return (
      <div className="bg-amber-950/50 border-2 border-amber-500/80 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                {autoPay ? <>Payment Past Due &bull; Grace Period Active</> : <>Plan Ended &bull; Grace Period Active</>}
              </span>
              {graceEnd && (
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded border border-amber-500/40">
                  Expires {graceEnd}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-300 mt-0.5">
              {autoPay
                ? "Your automatic renewal payment did not go through. Your plan stays on meanwhile. Pay now to keep it, or it moves to Free when the grace period ends."
                : "The time you paid for has ended. Your plan stays on for a few days. Renew to keep it, or it moves to Free when the grace period ends."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/billing")}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all whitespace-nowrap cursor-pointer shrink-0"
        >
          {autoPay ? "Pay now →" : "Renew →"}
        </button>
      </div>
    );
  }

  // 2. Free Plan Usage Banner
  if (plan === "free" || status === "expired" || status === "canceled") {
    return (
      <div className="bg-gradient-to-r from-[#181226] via-[#12141c] to-[#151724] border-2 border-yellow-400/40 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40">
              <svg className="w-3 h-3 text-yellow-400 fill-current" viewBox="0 0 20 20">
                <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" />
              </svg>
              Free Plan
            </span>
            <span className="text-xs text-gray-400">
              {envelopesUsed} of {monthlyLimit} documents used this month
              {extraDocuments > 0 ? ` · ${extraDocuments} extra documents in hand` : ""}
            </span>
          </div>
          <div className="w-full max-w-md bg-black/50 h-2.5 rounded-full overflow-hidden border border-white/10">
            <div
              className={`h-full transition-all rounded-full ${
                percentage > 80 ? "bg-red-500" : "bg-gradient-to-r from-yellow-400 to-amber-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Need more documents each month? Move to Pro, or buy a pack of extra documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/billing/plans")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#ef4444] hover:shadow-[4px_4px_0px_0px_#ef4444] transition-all whitespace-nowrap cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-black fill-current" viewBox="0 0 20 20">
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" />
            </svg>
            Upgrade to Pro
          </button>
          <button
            type="button"
            onClick={() => navigate("/billing/add-ons")}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black transition-all whitespace-nowrap cursor-pointer"
          >
            Extra documents
          </button>
        </div>
      </div>
    );
  }

  // 3. Active Paid Plan Banner (Dismissible)
  if (isDismissed) {
    return null;
  }

  return (
    <div className="bg-[#12141c] border border-emerald-500/40 rounded-xl px-3.5 py-2 flex items-center justify-between shadow-sm relative group transition-all text-xs">
      <div className="flex items-center gap-2.5 pr-2">
        <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold uppercase tracking-wider text-white text-[11px]">
            {plan.toUpperCase()} Plan
          </span>
          <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40">
            Active
          </span>
          <span className="hidden md:inline text-[11px] text-gray-400">• Usage and invoices are on plans &amp; billing</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/billing")}
          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline transition-colors"
        >
          Billing
        </button>
        <button
          onClick={() => handleDismissPlanBanner(plan)}
          className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors text-xs"
          title="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
