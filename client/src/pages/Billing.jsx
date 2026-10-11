import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import {
  fetchUserSubscription,
  fetchWalletApi,
  fetchBillingProfileApi,
  saveBillingProfileApi,
  fetchInvoicesApi,
  downloadInvoiceApi,
} from "../api/billing.api";
import { payFor, rupees, rupeesFromPaise } from "../utils/checkout";

/**
 * A sender's plan, usage, wallet, invoice details and invoices in one place
 * (plan tasks P4-14 to P4-16). Everything bought here goes through the same checkout.
 */

// State codes as GST uses them
const STATES = [
  ["27", "Maharashtra"], ["29", "Karnataka"], ["07", "Delhi"], ["33", "Tamil Nadu"], ["36", "Telangana"], ["24", "Gujarat"],
  ["19", "West Bengal"], ["09", "Uttar Pradesh"], ["08", "Rajasthan"], ["32", "Kerala"], ["06", "Haryana"], ["03", "Punjab"],
  ["23", "Madhya Pradesh"], ["37", "Andhra Pradesh"], ["10", "Bihar"], ["21", "Odisha"], ["18", "Assam"], ["20", "Jharkhand"],
  ["22", "Chhattisgarh"], ["05", "Uttarakhand"], ["02", "Himachal Pradesh"], ["30", "Goa"], ["01", "Jammu and Kashmir"], ["04", "Chandigarh"],
  ["34", "Puducherry"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"],
  ["16", "Tripura"], ["17", "Meghalaya"], ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["31", "Lakshadweep"], ["35", "Andaman and Nicobar Islands"], ["38", "Ladakh"],
];

const card = "bg-[#12141c] border border-white/10 rounded-2xl p-6";
const inputClass = "w-full px-3 py-2.5 bg-[#08090d] border border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500";
const day = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function Billing() {
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [profile, setProfile] = useState({ legalName: "", address: "", gstin: "", stateCode: "" });
  const [busy, setBusy] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const load = async () => {
    const [subscription, walletData, invoiceList, billingProfile] = await Promise.all([
      fetchUserSubscription(),
      fetchWalletApi(),
      fetchInvoicesApi(),
      fetchBillingProfileApi(),
    ]);
    setData(subscription);
    setWallet(walletData);
    setInvoices(invoiceList);
    setProfile({ legalName: "", address: "", gstin: "", stateCode: "", ...billingProfile });
  };

  useEffect(() => {
    load().catch(() => toast.error("Your billing details could not be loaded."));
  }, []);

  const buy = async (kind, item) => {
    try {
      setBusy(`${kind}:${item}`);
      const outcome = await payFor(kind, item);
      if (outcome === "cancelled") return;
      toast.success(outcome === "simulated" ? "Simulated payment applied." : "Payment received. It will show here in a moment.");
      // A real payment is confirmed by the provider a moment after the window closes
      if (outcome === "paid") await new Promise((resolve) => setTimeout(resolve, 2500));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy("");
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      setSavingProfile(true);
      setProfile(await saveBillingProfileApi(profile));
      toast.success("Invoice details saved.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Those details could not be saved.");
    } finally {
      setSavingProfile(false);
    }
  };

  const download = async (invoice) => {
    try {
      const blob = await downloadInvoiceApi(invoice.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.number.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("The invoice could not be downloaded.");
    }
  };

  if (!data || !wallet) {
    return (
      <div className="min-h-screen bg-[#08090d]">
        <Navbar />
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const { subscription, usage, entitlements, catalogue, billingEnabled } = data;
  const currentPlan = catalogue.plans.find((plan) => plan.id === subscription.plan);
  const planName = currentPlan?.name || (subscription.plan === "lifetime" ? "Lifetime" : subscription.plan);
  const onPaidTier = entitlements.tier !== "free";
  const proPlans = catalogue.plans.filter((plan) => plan.tier === "pro" && plan.purchasable);

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Billing</h1>
          <p className="text-xs text-gray-400 mt-1">
            Prices are in rupees and include GST. <Link to="/pricing" className="text-red-400 underline">Compare plans</Link>
          </p>
        </div>

        {!billingEnabled && (
          <p className="px-4 py-3 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200 text-xs" role="status">
            Paid plans are not on sale yet. You can use the Free plan in the meantime.
          </p>
        )}

        {/* Plan and usage */}
        <section className={card} data-testid="billing-plan">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase font-bold text-gray-500">Your plan</p>
              <p className="text-xl font-black text-white mt-1">{planName}</p>
              {subscription.currentPeriodEnd && subscription.plan !== "lifetime" && onPaidTier && (
                <p className="text-xs text-gray-400 mt-1">Paid until {day(subscription.currentPeriodEnd)}. It does not renew by itself.</p>
              )}
            </div>
            <div className="text-right" data-testid="billing-usage">
              <p className="text-[11px] uppercase font-bold text-gray-500">Documents this month</p>
              <p className="text-xl font-black text-white mt-1">
                {usage.usedThisMonth}
                {usage.monthlyQuota !== null && <span className="text-gray-500"> of {usage.monthlyQuota}</span>}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {usage.monthlyQuota === null ? "No monthly limit" : `Allowance renews on ${day(usage.resetsOn)}`}
                {usage.extraDocuments > 0 && ` · ${usage.extraDocuments} extra documents in hand`}
              </p>
            </div>
          </div>

          {!onPaidTier && (
            <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap gap-3">
              {proPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => buy("plan", plan.id)}
                  disabled={Boolean(busy) || !billingEnabled}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold"
                >
                  Get Pro for {rupees(plan.priceInr)} a {plan.interval} · {plan.documentsPerMonth} documents a month
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Extra documents */}
          <section className={card} data-testid="billing-topups">
            <h2 className="text-sm font-bold text-white">Extra documents</h2>
            <p className="text-xs text-gray-400 mt-1">Used after your monthly allowance. They do not expire at month end.</p>
            <div className="mt-4 space-y-2">
              {catalogue.topups.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => buy("topup", pack.id)}
                  disabled={Boolean(busy) || !billingEnabled}
                  className="w-full flex justify-between items-center px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl text-sm text-gray-200"
                >
                  <span>{pack.documents} extra documents</span>
                  <span className="font-bold text-white">{rupees(pack.priceInr)}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Wallet */}
          <section className={card} data-testid="billing-wallet">
            <h2 className="text-sm font-bold text-white">Wallet</h2>
            <p className="text-xs text-gray-400 mt-1">Prepaid credit for SMS and WhatsApp messages. Nothing is taken from it unless you use them.</p>
            <p className="text-2xl font-black text-white mt-3" data-testid="wallet-balance">
              {rupeesFromPaise(wallet.balancePaise)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {catalogue.walletPacks.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => buy("wallet", pack.id)}
                  disabled={Boolean(busy) || !billingEnabled}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl text-xs font-bold text-gray-200"
                >
                  Add {rupees(pack.amountInr)}
                </button>
              ))}
            </div>
            {wallet.entries.length > 0 && (
              <ul className="mt-4 space-y-1 text-xs text-gray-400 max-h-40 overflow-y-auto">
                {wallet.entries.map((entry) => (
                  <li key={entry.reference} className="flex justify-between">
                    <span>
                      {day(entry.at)} · {entry.reason}
                    </span>
                    <span className={entry.type === "credit" ? "text-emerald-400" : "text-gray-300"}>
                      {entry.type === "credit" ? "+" : "-"}
                      {rupeesFromPaise(entry.amountPaise)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Details for invoices */}
        <section className={card}>
          <h2 className="text-sm font-bold text-white">Details for your invoices</h2>
          <p className="text-xs text-gray-400 mt-1">Add your GST number if you want it on your invoices. Invoices already issued do not change.</p>
          <form onSubmit={saveProfile} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-[11px] text-gray-400 space-y-1">
              <span>Name on the invoice</span>
              <input className={inputClass} value={profile.legalName} maxLength={120} onChange={(e) => setProfile({ ...profile, legalName: e.target.value })} />
            </label>
            <label className="text-[11px] text-gray-400 space-y-1">
              <span>GST number (optional)</span>
              <input
                className={`${inputClass} uppercase`}
                value={profile.gstin}
                maxLength={15}
                placeholder="27ABCDE1234F1Z5"
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
              />
            </label>
            <label className="text-[11px] text-gray-400 space-y-1 md:col-span-2">
              <span>Address</span>
              <input className={inputClass} value={profile.address} maxLength={300} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
            </label>
            <label className="text-[11px] text-gray-400 space-y-1">
              <span>State</span>
              <select
                className={inputClass}
                value={profile.gstin ? profile.gstin.slice(0, 2) : profile.stateCode}
                disabled={Boolean(profile.gstin)}
                onChange={(e) => setProfile({ ...profile, stateCode: e.target.value })}
              >
                <option value="">Choose...</option>
                {STATES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={savingProfile} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white rounded-xl text-xs font-bold">
                Save details
              </button>
            </div>
          </form>
        </section>

        {/* Invoices */}
        <section className={card} data-testid="billing-invoices">
          <h2 className="text-sm font-bold text-white">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-xs text-gray-500 mt-3">No payments yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/5">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-gray-300">
                    <strong className="text-white font-mono text-xs">{invoice.number}</strong> · {day(invoice.issuedAt)} · {invoice.description}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-bold text-white">{rupeesFromPaise(invoice.totalPaise)}</span>
                    <button onClick={() => download(invoice)} className="text-xs text-red-400 underline">
                      Download {invoice.kind === "tax_invoice" ? "invoice" : "receipt"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
