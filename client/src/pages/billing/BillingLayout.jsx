import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../../components/Navbar";
import useBillingAccount from "../../hooks/useBillingAccount";
import { PRICING_FALLBACK } from "../../config/pricingFallback";
import { offersOf } from "../../utils/plans";
import { payFor } from "../../utils/checkout";
import { standingOf, legacyBillingPath, checkoutPath, day } from "../../utils/billing";
import { stopAutoRenewApi, devRenewApi } from "../../api/billing.api";
import { Note, Spinner } from "../../components/billing/ui";
import { BTN } from "../../components/billing/theme";

/**
 * Billing, for a signed-in account: one heading, four tabs, and the account read once for all
 * of them.
 *   Overview       how the plan stands, this month's documents, wallet, the latest invoices
 *   Plans          every plan, to move to another or to the plan's other price
 *   Add-ons        extra documents and wallet credit, each one payment
 *   Invoices       every payment's invoice, and the details printed on them
 * A plan is bought on its own page (pages/billing/Checkout.jsx); the public price list is
 * /pricing (pages/Pricing.jsx).
 *
 * Links from before the tabs (/billing#topups, /billing?plan=pro_annual, ...) are still in
 * emails and bookmarks, and are sent on to where they meant.
 */

const TABS = [
  ["/billing", "Overview", true],
  ["/billing/plans", "Plans", false],
  ["/billing/add-ons", "Extra documents & wallet", false],
  ["/billing/invoices", "Invoices", false],
];

export default function BillingLayout() {
  const billing = useBillingAccount();
  const { user, account, failed, load, reload } = billing;
  const location = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  // Signing in is restored a moment after the page opens; only then is "sign in" the answer
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // An old address goes where it meant
  useEffect(() => {
    if (location.pathname.replace(/\/+$/, "") !== "/billing") return;
    const to = legacyBillingPath(location.hash, location.search);
    if (to) navigate(to, { replace: true });
  }, [location.pathname, location.hash, location.search, navigate]);

  const catalogue = account?.catalogue || null;
  const plans = catalogue?.plans?.length ? catalogue.plans : PRICING_FALLBACK.plans;
  const offers = offersOf(plans);
  const mine = account ? standingOf(account, plans, offers) : null;
  const billingEnabled = account ? Boolean(account.billingEnabled) : true;
  const held = Boolean(busy) || !billingEnabled;

  // One payment for extra documents ("topup", any number of a pack: `quantity`) or wallet credit
  // ("wallet": a set amount, or "custom" with `amountInr`). Once paid, the customer is on the
  // page that confirms the payment; only a payment given up comes back here.
  const buy = async (kind, item, how = {}) => {
    try {
      setBusy(`${kind}:${item}`);
      const outcome = await payFor(kind, item, how);
      if (outcome === "cancelled") toast("Payment not completed. Nothing was charged.", { icon: "ℹ️" });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy("");
    }
  };

  const stopRenewing = async () => {
    const until = mine?.renewal.nextChargeOn;
    if (!window.confirm(`Turn off auto-renew?\n\nNothing more will be charged. Your plan stays as it is until ${day(until)} and then moves to Free, unless you buy more time.`)) return;
    try {
      setBusy("renewal");
      const res = await stopAutoRenewApi();
      toast.success(res?.message || "Auto-renew is off.");
      await reload();
    } catch (err) {
      toast.error(err.response?.data?.message || "Auto-renew could not be turned off. Please try again.");
    } finally {
      setBusy("");
    }
  };

  // Development only
  const simulateRenewal = async () => {
    try {
      setBusy("renewal");
      await devRenewApi();
      toast.success("Simulated renewal applied.");
      await reload();
    } catch (err) {
      toast.error(err.response?.data?.message || "The renewal could not be simulated.");
    } finally {
      setBusy("");
    }
  };

  const goCheckout = (record, how) => navigate(checkoutPath(record.id, how));

  const context = { ...billing, catalogue, plans, offers, mine, busy, held, billingEnabled, buy, stopRenewing, simulateRenewal, goCheckout };
  const here = `${location.pathname}${location.search}${location.hash}`;

  return (
    <div className="min-h-screen bg-[#0a0b10] text-gray-100 font-sans">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-9 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[34px] font-bold tracking-tight text-white">Billing</h1>
            <p className="mt-1.5 text-[15px] text-gray-400">Your plan, usage, add-ons and invoices. Prices are in rupees and include GST.</p>
          </div>
          <Link to="/pricing" className={`${BTN.secondary} hidden sm:inline-flex`}>
            See public pricing
          </Link>
        </div>

        <nav aria-label="Billing sections" className="mt-6 flex gap-7 border-b border-white/[0.08] overflow-x-auto">
          {TABS.map(([to, label, end]) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `py-3.5 whitespace-nowrap text-sm font-bold border-b-2 transition-colors ${isActive ? "text-white border-rose-500" : "text-gray-400 border-transparent hover:text-white"}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-7">
          {!user ? (
            waited ? (
              <div className="max-w-lg mx-auto text-center py-16">
                <h2 className="font-display text-2xl font-bold text-white">Sign in to see your billing</h2>
                <p className="mt-2 text-gray-400">Your plan, invoices and wallet are shown once you are signed in. Prices for everyone are on the pricing page.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link to={`/login?next=${encodeURIComponent(here)}`} className={BTN.primary}>
                    Sign in
                  </Link>
                  <Link to="/pricing" className={BTN.secondary}>
                    See pricing
                  </Link>
                </div>
              </div>
            ) : (
              <Loading />
            )
          ) : failed ? (
            <Note tone="red" icon="alert" role="alert">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Your billing details could not be loaded.</span>
                <button type="button" onClick={load} className={BTN.small + " bg-white/10 hover:bg-white/15 text-white"}>
                  Try again
                </button>
              </div>
            </Note>
          ) : !account ? (
            <Loading />
          ) : (
            <>
              {!billingEnabled && (
                <Note tone="amber" role="status" className="mb-6">
                  Paid plans are not on sale yet. You can use the Free plan in the meantime.
                </Note>
              )}
              <Outlet context={context} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const Loading = () => (
  <div className="py-24 grid place-items-center" role="status" aria-label="Loading your billing">
    <Spinner className="w-9 h-9" colour="#f43f5e" />
  </div>
);
