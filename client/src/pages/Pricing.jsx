import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import Navbar from "../components/Navbar";
import PricingCards from "../components/PricingCards";
import { PRICING_FALLBACK } from "../config/pricingFallback";
import { fetchPlansApi } from "../api/billing.api";
import { rupees } from "../utils/checkout";

/**
 * Plans and prices (plan task P4-17). The figures come from the server's price list, so this
 * page cannot disagree with what checkout charges. It is written out as HTML when the site is
 * built: the data then arrives from the build (`initial`) or embedded in the page.
 */

const embedded = () => {
  if (typeof document === "undefined") return null;
  try {
    return JSON.parse(document.getElementById("public-pricing-data")?.textContent || "null");
  } catch {
    return null;
  }
};

const YES = <span className="text-emerald-400 font-bold">✓</span>;
const NO = <span className="text-gray-600">—</span>;

// What each plan includes. Must stay true to services/entitlements.service.js on the server.
//   feature                                   free            pro              business            enterprise
const COMPARISON = (plans) => {
  const docs = (id) => plans.find((p) => p.id === id)?.documentsPerMonth;
  return [
    ["Documents a month", `${docs("free")}`, `${docs("pro_monthly")}`, `${docs("business_monthly")} a seat, pooled`, "Agreed with you"],
    ["Extra documents when you run out", YES, YES, YES, YES],
    ["Sealed PDF with a signing record", YES, YES, YES, YES],
    ["Signing in English and Hindi", YES, YES, YES, YES],
    ["Ready-made templates", "Starter pack", "Every Pro pack", "Every Pro pack", "Every pack"],
    ["Save your own templates", NO, YES, YES, YES],
    ["Bulk send", NO, "25 at a time", "500 at a time", "5,000 at a time"],
    ["\"Signed with PactDoc\" line on your documents", "Shown", "Removed", "Removed", "Removed"],
    ["Team workspaces, roles and invitations", NO, NO, YES, YES],
    ["Your name and logo for signers", NO, NO, YES, YES],
    ["API keys, webhooks and embedded signing", NO, NO, NO, YES],
    ["Single sign-on", NO, NO, NO, YES],
  ];
};

export default function Pricing({ initial }) {
  const user = useSelector((state) => state.auth.user);
  const [catalogue, setCatalogue] = useState(() => initial || embedded());
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    if (catalogue) return;
    fetchPlansApi()
      .then(setCatalogue)
      .catch(() => setCatalogue(null));
  }, [catalogue]);

  const plans = catalogue?.plans?.length ? catalogue.plans : PRICING_FALLBACK.plans;
  const monthly = plans.find((p) => p.id === "pro_monthly");
  const annual = plans.find((p) => p.id === "pro_annual");
  // What paying for a year saves over twelve single months, in whole per cent
  const saving = monthly && annual ? Math.round((1 - annual.priceInr / (monthly.priceInr * 12)) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#08090d] text-white selection:bg-red-600 selection:text-white flex flex-col font-sans">
      {user && <Navbar />}

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          {!user && (
            <Link to="/" className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-white mb-1">
              <span>← Back to Home</span>
            </Link>
          )}

          <div className="flex items-center justify-center gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-400/10 text-yellow-400 border border-yellow-400/30">
              Simple, Transparent Pricing
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Choose the Perfect Plan for{" "}
            <span className="whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-yellow-400">Your E-Signatures</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-lg mx-auto">
            Start free with {plans.find((p) => p.id === "free")?.documentsPerMonth} documents a month. Prices are in rupees and include GST, with no charge per signer.
          </p>

          {/* Monthly or yearly */}
          <div className="pt-2 flex justify-center">
            <div className="bg-[#12141c] p-0.5 rounded-xl border border-white/15 shadow-md inline-flex items-center" role="group" aria-label="Billing period">
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${!yearly ? "bg-red-600 text-white shadow-sm font-black" : "text-gray-400 hover:text-white"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${yearly ? "bg-red-600 text-white shadow-sm font-black" : "text-gray-400 hover:text-white"}`}
              >
                <span>Annual</span>
                {saving > 0 && <span className="bg-yellow-400 text-black text-[9px] px-1.5 rounded font-black border border-black">SAVE {saving}%</span>}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <PricingCards catalogue={catalogue} yearly={yearly} user={user} />
        </div>

        {catalogue && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <section className="bg-[#12141c] rounded-2xl p-5 sm:p-6 border-2 border-white/10" data-testid="topups">
              <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 text-[10px] font-black uppercase tracking-wider rounded border border-emerald-500/30">Any Plan</span>
              <h2 className="text-lg font-black text-white mt-3">Need more documents this month?</h2>
              <p className="text-xs text-gray-400 mt-1">Extra documents are used after your monthly allowance and do not expire at month end.</p>
              <ul className="mt-4 divide-y divide-white/5 text-sm text-gray-300">
                {catalogue.topups.map((pack) => (
                  <li key={pack.id} className="flex justify-between py-2">
                    <span>{pack.documents} extra documents</span>
                    <span className="font-black text-white">{rupees(pack.priceInr)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-[#12141c] rounded-2xl p-5 sm:p-6 border-2 border-white/10">
              <span className="px-2.5 py-1 bg-blue-500/15 text-blue-300 text-[10px] font-black uppercase tracking-wider rounded border border-blue-500/30">Pay As You Go</span>
              <h2 className="text-lg font-black text-white mt-3">Signing links by SMS and WhatsApp</h2>
              <p className="text-xs text-gray-400 mt-1">Paid from a prepaid wallet, only when you use them.</p>
              <ul className="mt-4 divide-y divide-white/5 text-sm text-gray-300">
                <li className="flex justify-between py-2">
                  <span>Signing link by SMS</span>
                  <span className="font-black text-white">₹{(catalogue.usagePricesPaise.sms / 100).toFixed(2)} a message</span>
                </li>
                <li className="flex justify-between py-2">
                  <span>Signing link by WhatsApp</span>
                  <span className="font-black text-white">₹{(catalogue.usagePricesPaise.whatsapp / 100).toFixed(2)} a message</span>
                </li>
              </ul>
              <p className="text-[11px] text-gray-500 mt-3">SMS and WhatsApp delivery are being set up and are not switched on yet.</p>
            </section>
          </div>
        )}

        {/* Feature comparison */}
        <div className="mt-12 bg-[#12141c] rounded-2xl p-5 sm:p-8 border-2 border-white/10" data-testid="comparison">
          <div className="text-center max-w-xl mx-auto mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white">Full Feature Comparison</h2>
            <p className="text-xs text-gray-400 mt-1">What each plan includes, side by side.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-white/10 text-gray-400">
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider">Features</th>
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider text-center">Free</th>
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider text-center text-yellow-400">Pro</th>
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider text-center text-purple-400">Business</th>
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider text-center text-blue-400">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {COMPARISON(plans).map(([feature, ...cells]) => (
                  <tr key={feature}>
                    <td className="py-2.5 px-3 font-semibold text-white">{feature}</td>
                    {cells.map((cell, index) => (
                      <td key={index} className={`py-2.5 px-3 text-center ${["", "text-yellow-400", "text-purple-400", "text-blue-400"][index]} ${typeof cell === "string" ? "font-bold" : ""}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
