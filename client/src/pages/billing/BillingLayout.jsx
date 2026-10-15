import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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
 * Billing, for a signed-in account: four sections, chosen from the Billing menu in the navbar
 * (components/Navbar.jsx), and the account read once for all of them.
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
    const ask = mine?.renewal.overdue
      ? "Turn off auto-renew?\n\nYour last automatic payment did not go through, so your plan moves to Free now. To keep it, pay instead from the Overview."
      : `Turn off auto-renew?\n\nNothing more will be charged and nothing is refunded. Your plan stays as it is until ${day(until)} and then moves to Free, unless you buy more time.`;
    if (!window.confirm(ask)) return;
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
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        {/* The sections are chosen from the Billing menu in the navbar; the heading is there for screen readers */}
        <h1 className="sr-only">Billing</h1>

        <div>
          {!user ? (
            waited ? (
              <div className="max-w-lg mx-auto text-center py-16">
                <h2 className="text-2xl font-black uppercase tracking-tight text-white">Sign in to see your billing</h2>
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
                <button type="button" onClick={load} className={BTN.small}>
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
    <Spinner className="w-10 h-10" />
  </div>
);
