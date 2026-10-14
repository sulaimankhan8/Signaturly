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
import { Pill } from "../components/billing/ui";
import { BTN, ICONS } from "../components/billing/theme";

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
    <div className="min-h-screen bg-[#0a0b10] text-gray-100 font-sans">
      {user ? (
        <Navbar />
      ) : (
        <header className="border-b border-white/[0.07]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
            <Link to="/" className="font-display text-[21px] font-bold tracking-tight text-white">
              Pact<span className="text-rose-500">Doc</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-3 py-2 text-sm font-bold text-gray-300 hover:text-white">
                Sign in
              </Link>
              <Link to="/register" className={BTN.primary}>
                Start free
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-20 grid gap-16">
        <div className="relative text-center max-w-3xl mx-auto">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[38rem] max-w-full h-56 bg-rose-600/10 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
          <p className="relative">
            <Pill tone="yellow" className="uppercase tracking-[0.12em] !text-[11px]">
              Plans and prices
            </Pill>
          </p>
          <h1 className="relative mt-5 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1]">
            E-signatures priced for <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300">how much you send</span>
          </h1>
          <p className="relative mt-4 text-base text-gray-400 leading-relaxed max-w-xl mx-auto">
            Start free with {free?.documentsPerMonth ?? 5} documents a month. A document is one PDF sent for signature, however many people sign it. Prices are in rupees.
          </p>
          <ul className="relative mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-300">
            {FACTS.map((fact) => (
              <li key={fact} className="inline-flex items-center gap-1.5">
                <ICONS.check className="w-4 h-4 text-emerald-400" />
                {fact}
              </li>
            ))}
          </ul>
          {user && (
            <p className="relative mt-5 text-sm text-gray-400">
              Signed in?{" "}
              <Link to="/billing" className="font-bold text-rose-300 hover:text-rose-200">
                Your plan and invoices are under Billing →
              </Link>
            </p>
          )}
        </div>

        <PricingCards catalogue={list} user={user} defaultYearly />

        <PlanComparison catalogue={list} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section aria-labelledby="extra-heading" className="rounded-[18px] p-6 bg-gradient-to-b from-sky-400/10 to-[#12141c] to-60% border border-sky-400/25" data-testid="billing-topups">
            <h2 id="extra-heading" className="font-display text-xl font-bold text-white">
              Extra documents, when you need them
            </h2>
            <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">One payment on any plan, Free included. Used after the monthly allowance, and they never expire. No subscription, no wallet needed.</p>
            {topups.length > 0 ? (
              <ul className="mt-4 grid gap-2">
                {topups.map((pack) => (
                  <li key={pack.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-black/20 border border-white/[0.07]">
                    <span className="font-bold text-white">{pack.documents} extra documents</span>
                    <span className="text-sm text-gray-400">
                      ₹{(pack.priceInr / pack.documents).toFixed(2)} each · <span className="font-display text-base font-bold text-white">{rupees(pack.priceInr)}</span>
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

          <section aria-labelledby="wallet-heading" className="rounded-[18px] p-6 bg-gradient-to-b from-violet-400/[0.11] to-[#12141c] to-60% border border-violet-400/25" data-testid="billing-wallet">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id="wallet-heading" className="font-display text-xl font-bold text-white">
                Wallet for SMS and WhatsApp
              </h2>
              <Pill tone="gray">Optional</Pill>
            </div>
            <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">Signing links by email are always free. The wallet pays only for links you choose to send by SMS or WhatsApp, and never tops itself up.</p>
            <ul className="mt-4 text-sm">
              <li className="flex justify-between gap-3 py-2.5 border-t border-white/[0.07]">
                <span className="text-gray-300">Signing link by email</span>
                <span className="font-bold text-emerald-300">Free</span>
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

        <section className="rounded-3xl px-6 py-10 text-center bg-gradient-to-br from-rose-600/20 via-[#12141c] to-violet-600/15 border border-white/[0.08]">
          <h2 className="font-display text-3xl font-bold text-white">Send your first document today</h2>
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
