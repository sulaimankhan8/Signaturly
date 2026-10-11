import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
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

// What each tier includes, in the words of the strategy. Limits and prices come from the server.
const TIER_POINTS = {
  free: ["The Starter templates, filled in by answering questions", "Email link to sign", "Sealed PDF and signing record", "English and Hindi for signers"],
  pro: ["Every Pro template pack", "Save your own templates", "Bulk send to 25 people at a time", "One-time code for signers", "Reminders and expiry"],
  enterprise: ["Everything in Pro", "API keys and webhooks", "Team workspaces", "All template packs", "A named contact"],
};

const Check = () => (
  <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

export default function Pricing({ initial }) {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [catalogue, setCatalogue] = useState(() => initial || embedded());
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    if (catalogue) return;
    fetchPlansApi()
      .then(setCatalogue)
      .catch(() => setCatalogue(null));
  }, [catalogue]);

  const plan = (id) => catalogue?.plans.find((p) => p.id === id);
  const free = plan("free");
  const pro = plan(yearly ? "pro_annual" : "pro_monthly");
  const enterprise = plan("enterprise");

  // Signed in: buying happens on the billing page. Not signed in: create an account first.
  const buyHref = user ? "/billing" : "/register?next=%2Fbilling";

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-black text-white">
            Pact<span className="text-red-500">Doc</span>
          </Link>
          <nav className="flex items-center gap-5 text-xs font-bold text-gray-300">
            <Link to="/t" className="hover:text-white">
              Templates
            </Link>
            {user ? (
              <Link to="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="hover:text-white">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-white">Plans and pricing</h1>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">
            Start free. Pay when you send more than a handful of documents a month. Prices are in rupees and include GST.
          </p>

          <div className="inline-flex mt-6 bg-[#12141c] border border-white/10 rounded-xl p-1 text-xs font-bold" role="group" aria-label="Billing period">
            <button onClick={() => setYearly(false)} className={`px-4 py-2 rounded-lg ${!yearly ? "bg-red-600 text-white" : "text-gray-300"}`}>
              Monthly
            </button>
            <button onClick={() => setYearly(true)} className={`px-4 py-2 rounded-lg ${yearly ? "bg-red-600 text-white" : "text-gray-300"}`}>
              Yearly
            </button>
          </div>
        </div>

        {!catalogue ? (
          <p className="text-center text-sm text-gray-500 mt-12">Loading prices...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              {/* Free */}
              <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6 flex flex-col" data-testid="plan-free">
                <h2 className="text-lg font-bold text-white">{free.name}</h2>
                <p className="mt-3 text-4xl font-black text-white">{rupees(0)}</p>
                <p className="text-xs text-gray-400 mt-1">{free.documentsPerMonth} documents a month</p>
                <ul className="mt-5 space-y-2.5 text-sm text-gray-300 flex-1">
                  {TIER_POINTS.free.map((point) => (
                    <li key={point} className="flex gap-2">
                      <Check />
                      {point}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate(user ? "/dashboard" : "/register")}
                  className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold"
                >
                  {user ? "Go to dashboard" : "Start free"}
                </button>
              </section>

              {/* Pro */}
              <section className="bg-[#12141c] border-2 border-red-500/60 rounded-2xl p-6 flex flex-col" data-testid="plan-pro">
                <h2 className="text-lg font-bold text-white">Pro</h2>
                <p className="mt-3 text-4xl font-black text-white">
                  {rupees(pro.priceInr)}
                  <span className="text-sm font-bold text-gray-400"> a {pro.interval}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">{pro.documentsPerMonth} documents a month</p>
                <ul className="mt-5 space-y-2.5 text-sm text-gray-300 flex-1">
                  {TIER_POINTS.pro.map((point) => (
                    <li key={point} className="flex gap-2">
                      <Check />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link to={buyHref} className="mt-6 w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold text-center">
                  Get Pro
                </Link>
              </section>

              {/* Enterprise */}
              <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6 flex flex-col" data-testid="plan-enterprise">
                <h2 className="text-lg font-bold text-white">{enterprise.name}</h2>
                <p className="mt-3 text-4xl font-black text-white">
                  <span className="text-sm font-bold text-gray-400">from </span>
                  {rupees(enterprise.priceInr)}
                  <span className="text-sm font-bold text-gray-400"> a month</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Documents and price agreed with you</p>
                <ul className="mt-5 space-y-2.5 text-sm text-gray-300 flex-1">
                  {TIER_POINTS.enterprise.map((point) => (
                    <li key={point} className="flex gap-2">
                      <Check />
                      {point}
                    </li>
                  ))}
                </ul>
                <a href="mailto:sales@pactdoc.com" className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold text-center">
                  Talk to us
                </a>
              </section>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6" data-testid="topups">
                <h2 className="text-sm font-bold text-white">Need more documents this month?</h2>
                <p className="text-xs text-gray-400 mt-1">Buy extra documents on any plan. They are used after your monthly allowance and do not expire at month end.</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {catalogue.topups.map((pack) => (
                    <li key={pack.id} className="flex justify-between">
                      <span>{pack.documents} extra documents</span>
                      <span className="font-bold text-white">{rupees(pack.priceInr)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white">Pay-as-you-go extras</h2>
                <p className="text-xs text-gray-400 mt-1">Paid from a prepaid wallet, only when you use them.</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  <li className="flex justify-between">
                    <span>Signing link by SMS</span>
                    <span className="font-bold text-white">₹{(catalogue.usagePricesPaise.sms / 100).toFixed(2)} a message</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Signing link by WhatsApp</span>
                    <span className="font-bold text-white">₹{(catalogue.usagePricesPaise.whatsapp / 100).toFixed(2)} a message</span>
                  </li>
                </ul>
                <p className="text-[11px] text-gray-500 mt-3">SMS and WhatsApp delivery are being set up and are not switched on yet.</p>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
