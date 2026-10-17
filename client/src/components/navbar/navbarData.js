// The billing button's look, by what it says (utils/billing.js billingCtaOf)
export const CTA_LOOKS = {
  upgrade: "text-black bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-300 shadow-[2px_2px_0px_0px_#ef4444] hover:shadow-[3px_3px_0px_0px_#ef4444]",
  documents: "text-black bg-sky-300 hover:bg-sky-200 shadow-[2px_2px_0px_0px_#facc15]",
  fix: "text-white bg-red-600 hover:bg-red-500 shadow-[2px_2px_0px_0px_#facc15]",
};

// The sections of Billing, as the Billing menu lists them. Each chip turns solid on its own page.
export const BILLING_LINKS = [
  {
    to: "/billing",
    label: "Overview",
    hint: "Your plan, usage and next payment",
    chip: "bg-red-600/20 border-red-500/40 text-red-400 group-hover:bg-red-600 group-hover:text-white",
    on: "bg-red-600 border-black text-white",
    d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    to: "/billing/plans",
    label: "Plans",
    hint: "Compare plans and upgrade",
    chip: "bg-yellow-400/20 border-yellow-400/40 text-yellow-300 group-hover:bg-yellow-400 group-hover:text-black",
    on: "bg-yellow-400 border-black text-black",
    d: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    to: "/billing/add-ons",
    label: "Extra docs & wallet",
    hint: "One payment, they never expire",
    chip: "bg-blue-600/20 border-blue-500/40 text-blue-400 group-hover:bg-blue-600 group-hover:text-white",
    on: "bg-blue-600 border-black text-white",
    d: "M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    to: "/billing/invoices",
    label: "Invoices",
    hint: "GST invoices and the details on them",
    chip: "bg-emerald-600/20 border-emerald-500/40 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white",
    on: "bg-emerald-500 border-black text-black",
    d: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
  },
];

// The plan and this month's documents, said at the top of the Billing menu
export const standingOf = (data) => {
  if (!data) return null;
  const planId = data.entitlements?.plan || data.subscription?.plan;
  const free = (data.entitlements?.tier || "free") === "free";
  const name = data.catalogue?.plans?.find((plan) => plan.id === planId)?.name || data.availablePlans?.[planId]?.name || (free ? "Free" : planId);
  const used = data.usage?.usedThisMonth || 0;
  const quota = data.usage?.monthlyQuota ?? null;
  const extra = data.usage?.extraDocuments || 0;
  return {
    name,
    left: quota === null ? "No monthly limit" : `${Math.max(0, quota - used)} of ${quota} documents left`,
    extra: extra > 0 ? `${extra} extra in hand` : "",
  };
};
