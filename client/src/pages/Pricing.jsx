import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import Navbar from "../components/Navbar";
import PricingCards from "../components/PricingCards";
import PlanComparison, { BillingFaq } from "../components/billing/PlanComparison";
import { PRICING_FALLBACK } from "../config/pricingFallback";
import { fetchPlansApi } from "../api/billing.api";
import { rupees } from "../utils/checkout";
import { perMessage } from "../utils/billing";
import { Pill, Assurances } from "../components/billing/ui";
import { BTN, PANEL } from "../components/billing/theme";
import BrandGlyph from "../components/BrandGlyph";

/**
 * The public price list, at /pricing: written out as HTML when the site is built, so search
 * engines and link previews get the prices themselves. A visitor's "Get Pro" leads to creating
 * an account and then straight to checkout for that plan; someone signed in goes straight to
 * checkout. An account's own plan, usage and invoices are under Billing (/billing).
 *
 * Yearly is shown to begin with, with what it saves: most people who buy a year buy it here.
 */

// The price list the build put in the page, where it did
const embedded = () => {
  if (typeof document === "undefined") return null;
  try {
    return JSON.parse(document.getElementById("public-pricing-data")?.textContent || "null");
  } catch {
    return null;
  }
};

const FACTS = ["Prices include GST", "No charge per signer", "Cancel auto-renew any time", "Pay by UPI, card or netbanking"];

export default function Pricing({ initial }) {
  const user = useSelector((state) => state.auth.user);
  const [catalogue, setCatalogue] = useState(() => initial || embedded());

  useEffect(() => {
    if (!catalogue) fetchPlansApi().then(setCatalogue).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = catalogue?.plans?.length ? catalogue : { ...PRICING_FALLBACK, ...(catalogue || {}), plans: PRICING_FALLBACK.plans };
  const free = list.plans.find((plan) => plan.id === "free");
  const topups = catalogue?.topups || [];
  const prices = catalogue?.usagePricesPaise || null;
  const smallest = topups.length ? topups.reduce((least, pack) => (pack.priceInr < least.priceInr ? pack : least)) : null;

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      {user ? (
        <Navbar />
      ) : (
        <header className="sticky top-0 z-40 bg-[#090a0f]/95 backdrop-blur-xl border-b-2 border-white/20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-2.5 group select-none">
              <span className="w-9 h-9 grid place-items-center rounded-xl bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#ffffff] group-hover:rotate-[-2deg] transition-transform" aria-hidden="true">
                <BrandGlyph className="w-6 h-6" />
              </span>
              <span className="text-lg font-black text-white tracking-tight">
                Pact<span className="text-red-500">Doc</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-3 py-2 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white">
                Sign in
              </Link>
              <Link to="/register" className={BTN.primary}>
                Start free
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-16 grid gap-7">
        <div className="text-center max-w-3xl mx-auto">
          <p>
            <Pill tone="yellow">Plans and prices</Pill>
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-[1.1]">
            E-signatures priced for{" "}
            <span className="inline-block mt-1 px-2.5 py-0.5 -rotate-1 rounded-lg border-2 border-black bg-yellow-400 text-black shadow-[3px_3px_0px_0px_#ef4444]">how much you send</span>
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-gray-300 leading-relaxed max-w-xl mx-auto">
            Start free with {free?.documentsPerMonth ?? 5} documents a month. A document is one PDF sent for signature, however many people sign it. Prices are in rupees.
          </p>
          {user && (
            <p className="mt-4 text-sm text-gray-400">
              Signed in?{" "}
              <Link to="/billing" className="font-bold text-yellow-400 hover:text-yellow-300 underline underline-offset-2">
                Your plan and invoices are under Billing →
              </Link>
            </p>
          )}
        </div>

        <PricingCards catalogue={list} user={user} defaultYearly />

        <div className="flex justify-center -mt-3">
          <Assurances items={FACTS} className="justify-center text-xs sm:text-sm" />
        </div>

        <PlanComparison catalogue={list} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section aria-labelledby="extra-heading" className={`${PANEL} shadow-[5px_5px_0px_0px_#3b82f6] p-6`} data-testid="billing-topups">
            <h2 id="extra-heading" className="text-xl font-black uppercase tracking-tight text-white">
              Extra documents, when you need them
            </h2>
            <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">One payment on any plan, Free included. Used after the monthly allowance, and they never expire. No subscription, no wallet needed.</p>
            {topups.length > 0 ? (
              <ul className="mt-4 grid gap-2">
                {topups.map((pack) => (
                  <li key={pack.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#090a0f] border-2 border-white/10">
                    <span className="font-black text-white">{pack.documents} extra documents</span>
                    <span className="text-sm text-gray-400">
                      ₹{(pack.priceInr / pack.documents).toFixed(2)} each · <span className="text-base font-black text-white tabular-nums">{rupees(pack.priceInr)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-400">{smallest ? `From ${rupees(smallest.priceInr)}.` : "Prices are shown once the price list has loaded."}</p>
            )}
            <Link to={user ? "/billing/add-ons" : `/register?next=${encodeURIComponent("/billing/add-ons")}`} className={`${BTN.secondary} mt-5`}>
              {user ? "Buy extra documents" : "Create an account to buy"}
            </Link>
          </section>

          <section aria-labelledby="wallet-heading" className={`${PANEL} shadow-[5px_5px_0px_0px_#a855f7] p-6`} data-testid="billing-wallet">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id="wallet-heading" className="text-xl font-black uppercase tracking-tight text-white">
                Wallet for SMS and WhatsApp
              </h2>
              <Pill tone="gray">Optional</Pill>
            </div>
            <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">Signing links by email are always free. The wallet pays only for links you choose to send by SMS or WhatsApp, and never tops itself up.</p>
            <ul className="mt-4 text-sm">
              <li className="flex justify-between gap-3 py-2.5 border-t border-white/[0.07]">
                <span className="text-gray-300">Signing link by email</span>
                <span className="font-black text-emerald-400">Free</span>
              </li>
              {prices && (
                <>
                  <li className="flex justify-between gap-3 py-2.5 border-t border-white/[0.07]">
                    <span className="text-gray-300">Signing link by SMS</span>
                    <span className="font-bold text-white">{perMessage(prices.sms)} each</span>
                  </li>
                  <li className="flex justify-between gap-3 py-2.5 border-t border-white/[0.07]">
                    <span className="text-gray-300">Signing link by WhatsApp</span>
                    <span className="font-bold text-white">{perMessage(prices.whatsapp)} each</span>
                  </li>
                </>
              )}
            </ul>
            <p className="mt-2 text-[13px] text-gray-400">SMS and WhatsApp delivery are being set up and are not switched on yet.</p>
          </section>
        </div>

        <BillingFaq />

        <section className="rounded-2xl px-6 py-10 text-center bg-[#13151f] border-2 border-white/20 shadow-[8px_8px_0px_0px_#ef4444]">
          <h2 className="text-3xl font-black uppercase tracking-tight text-white">Send your first document today</h2>
          <p className="mt-2 text-gray-400">
            {free?.documentsPerMonth ?? 5} documents a month on Free. No card needed. Upgrade whenever you send more.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to={user ? "/dashboard" : "/register"} className={BTN.primary}>
              {user ? "Go to dashboard" : "Start free"}
            </Link>
            {!user && (
              <Link to="/login" className={BTN.secondary}>
                Sign in
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
