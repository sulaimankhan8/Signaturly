import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import useBillingAccount from "../../hooks/useBillingAccount";
import useCheckoutQuote, { named, payLabelOf } from "../../hooks/useCheckoutQuote";
import { PRICING_FALLBACK } from "../../config/pricingFallback";
import { offersOf } from "../../utils/plans";
import { payFor, rupees } from "../../utils/checkout";
import { standingOf, checkoutSetupFor, day, rankOf, stateName, GST_RATE_FALLBACK } from "../../utils/billing";
import { saveBillingProfileApi } from "../../api/billing.api";
import { CheckoutChoices, OrderSummary, MoveNote } from "../../components/billing/CheckoutParts";
import InvoiceDetailsFields from "../../components/billing/InvoiceDetailsFields";
import { Note, Spinner } from "../../components/billing/ui";
import { BTN, PANEL, ICONS } from "../../components/billing/theme";

/**
 * Buying a plan, on a page of its own: /billing/checkout?plan=business_annual.
 *
 * Every "Get", "Upgrade" and "Switch" button in the app leads here with the plan chosen, and a
 * visitor comes here straight after creating an account. The choices are on the left (seats,
 * monthly or yearly, auto-renew or one period, extra documents, invoice details) and what is
 * charged is on the right, with the button that pays; on a phone the total and the button stay
 * at the bottom of the screen.
 *
 * `renew` ("auto" or "once") and `seats` in the address choose to begin with.
 */
export default function Checkout() {
  const [searchParams] = useSearchParams();
  const { user, account, profile, setProfile, failed, load } = useBillingAccount({ invoices: false, wallet: false });
  const location = useLocation();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const planId = searchParams.get("plan") || "";
  const here = `${location.pathname}${location.search}`;

  let body;
  if (!user) {
    body = waited ? (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="font-display text-3xl font-bold text-white">Create an account to continue</h1>
        <p className="mt-2 text-gray-400">It takes a minute. You come straight back here to pay.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={`/register?next=${encodeURIComponent(here)}`} className={BTN.primary}>
            Create an account
          </Link>
          <Link to={`/login?next=${encodeURIComponent(here)}`} className={BTN.secondary}>
            I have an account
          </Link>
        </div>
      </div>
    ) : (
      <Loading />
    );
  } else if (failed) {
    body = (
      <Note tone="red" icon="alert" role="alert">
        Your account could not be loaded.{" "}
        <button type="button" onClick={load} className="font-bold underline underline-offset-2">
          Try again
        </button>
      </Note>
    );
  } else if (!account) {
    body = <Loading />;
  } else {
    body = <CheckoutFor key={`${planId}:${searchParams.get("renew") || ""}`} planId={planId} account={account} email={user.email} profile={profile} setProfile={setProfile} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0b10] text-gray-100 font-sans">
      <Toaster position="top-right" />
      <header className="border-b border-white/[0.07] bg-[#0c0d13]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <Link to="/dashboard" className="font-display text-[21px] font-bold tracking-tight text-white">
              Pact<span className="text-rose-500">Doc</span>
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-400">
              <ICONS.lock className="w-3.5 h-3.5" /> Secure checkout
            </span>
          </div>
          <Link to={user ? "/billing/plans" : "/pricing"} className="text-sm font-bold text-gray-300 hover:text-white">
            ← Back to plans
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-32 lg:pb-16">{body}</main>
    </div>
  );
}

const Loading = () => (
  <div className="py-24 grid place-items-center" role="status" aria-label="Loading checkout">
    <Spinner className="w-9 h-9" colour="#f43f5e" />
  </div>
);

const Steps = () => (
  <ol aria-label="Progress" className="flex flex-wrap items-center gap-2 text-[13px] text-gray-400">
    <li className="inline-flex items-center gap-1.5">
      <span className="w-5 h-5 grid place-items-center rounded-full bg-emerald-400 text-[#04130d] text-[11px] font-bold" aria-hidden="true">
        ✓
      </span>
      Choose plan
    </li>
    <li className="w-7 h-px bg-white/20" aria-hidden="true" />
    <li aria-current="step" className="inline-flex items-center gap-1.5 text-white font-bold">
      <span className="w-5 h-5 grid place-items-center rounded-full bg-rose-600 text-white text-[11px] font-bold" aria-hidden="true">
        2
      </span>
      Review &amp; pay
    </li>
    <li className="w-7 h-px bg-white/20" aria-hidden="true" />
    <li className="inline-flex items-center gap-1.5">
      <span className="w-5 h-5 grid place-items-center rounded-full border border-white/25 text-[11px]" aria-hidden="true">
        3
      </span>
      Done
    </li>
  </ol>
);

function CheckoutFor({ planId, account, email, profile, setProfile }) {
  const [searchParams] = useSearchParams();
  const catalogue = account.catalogue || null;
  const plans = catalogue?.plans?.length ? catalogue.plans : PRICING_FALLBACK.plans;
  const offers = offersOf(plans);
  const mine = standingOf(account, plans, offers);
  const record = plans.find((plan) => plan.id === planId && plan.purchasable) || null;
  const setup = record ? checkoutSetupFor(mine, offers, record) : null;

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [dirty, setDirty] = useState(false);

  const wantedSeats = Number(searchParams.get("seats")) || null;
  const quote = useCheckoutQuote({
    plans: setup?.plans || [],
    planId: record?.id,
    ways: setup?.ways || [],
    prefer: searchParams.get("renew") === "once" ? "once" : "auto",
    paidUntil: setup?.paidUntil || null,
    seats: record?.perSeat ? (setup?.same ? mine.seats : null) || wantedSeats || 3 : null,
    chooseSeats: Boolean(record?.perSeat && !setup?.same),
    maxSeats: catalogue?.maxSeats,
    addOns: catalogue?.topups || [],
    gstRatePercent: catalogue?.gstRatePercent || GST_RATE_FALLBACK,
  });

  if (!record) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="font-display text-3xl font-bold text-white">That plan is not on sale</h1>
        <p className="mt-2 text-gray-400">It may have changed since the link was made. Every plan on sale is on the plans page.</p>
        <Link to="/billing/plans" className={`${BTN.primary} mt-6`}>
          See plans
        </Link>
      </div>
    );
  }

  if (setup.nothing) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="font-display text-3xl font-bold text-white">You are already on {record.name}</h1>
        <p className="mt-2 text-gray-400">It renews automatically on {day(mine.renewal.nextChargeOn)}. There is nothing to pay now.</p>
        <Link to="/billing" className={`${BTN.primary} mt-6`}>
          Go to Billing
        </Link>
      </div>
    );
  }

  const { plan } = quote;
  const title = setup.switching
    ? `Switch ${plan.name} to ${named(plan.interval).toLowerCase()} billing`
    : setup.same
      ? `Renew ${plan.name}`
      : !mine.paid
        ? `Get ${plan.name}`
        : quote.change === "downgrade" || rankOf(plan) < rankOf(mine.held)
          ? `Switch to ${plan.name}`
          : `Upgrade to ${plan.name}`;

  const pay = async () => {
    try {
      setBusy(true);
      setNotice("");
      // The invoice for this payment is printed with the details as they are now
      if (dirty) {
        const saved = await saveBillingProfileApi(draft);
        setProfile(saved);
        setDraft(saved);
        setDirty(false);
        setEditing(false);
      }
      // Once paid, the payment screen takes over and the page that confirms the payment follows,
      // so only a payment given up comes back here
      const outcome = await payFor("plan", plan.id, quote.payArgs);
      if (outcome === "cancelled") setNotice("cancelled");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy(false);
    }
  };

  const shownProfile = dirty || editing ? draft : profile;
  const hasDetails = Boolean(profile.legalName || profile.gstin);

  return (
    <div data-testid="plan-checkout">
      <Steps />
      <h1 className="mt-5 font-display text-[34px] font-bold tracking-tight text-white">{title}</h1>
      <p className="mt-1.5 text-gray-400">{quote.documents}. Prices include GST.</p>

      <div className="mt-7 flex flex-wrap gap-7 items-start">
        <div className="flex-[999_1_560px] min-w-0 grid gap-4">
          {notice === "cancelled" && (
            <Note tone="gray" icon="info" role="status" testId="checkout-cancelled">
              <strong className="text-white">Payment not completed.</strong> Nothing was charged, and your choices are kept. Press pay to try again; in the Razorpay window you can also switch to UPI, another card or netbanking.
            </Note>
          )}

          <MoveNote quote={quote} />

          {setup.switching && setup.paidUntil && (
            <Note tone="blue" icon="info" testId="checkout-switching">
              Your plan stays as it is until {day(setup.paidUntil)}. From then it is paid {named(plan.interval).toLowerCase()}: the payments you make now stop, and this one takes their place. Nothing is charged today.
            </Note>
          )}

          <CheckoutChoices quote={quote} busy={busy} chooseSeats={Boolean(plan.perSeat && !setup.same)} framed />

          <section aria-labelledby="details-heading" className={`${PANEL} px-5 sm:px-6 py-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="details-heading" className="text-base font-bold text-white">
                Invoice details
              </h2>
              {!editing && (
                <button type="button" onClick={() => setEditing(true)} className={`${BTN.small} text-gray-300 hover:text-white hover:bg-white/5`}>
                  {hasDetails ? "Change" : "Add GST details"}
                </button>
              )}
            </div>
            {editing ? (
              <div className="mt-4">
                <InvoiceDetailsFields
                  idPrefix="checkout-invoice"
                  profile={draft}
                  onChange={(next) => {
                    setDraft(next);
                    setDirty(true);
                  }}
                />
                <p className="mt-3 text-[13px] text-gray-400">Saved when you pay, and printed on the tax invoice for this payment.</p>
              </div>
            ) : hasDetails ? (
              <p className="mt-2 text-sm text-gray-300">
                {[shownProfile.legalName, shownProfile.gstin && `GSTIN ${shownProfile.gstin}`, stateName(shownProfile.gstin ? shownProfile.gstin.slice(0, 2) : shownProfile.stateCode)].filter(Boolean).join(" · ")}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-400">Buying for a business? Add your GST number to claim input tax credit.</p>
            )}
            <p className="mt-2 text-[13px] text-gray-400">Your tax invoice is emailed to {email || "you"} and kept under Billing › Invoices.</p>
          </section>

          <ul className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-[13px] text-gray-400">
            {["Prices include GST", "No charge per signer", "Cancel auto-renew any time", "GST invoice for every payment"].map((fact) => (
              <li key={fact} className="inline-flex items-center gap-1.5">
                <ICONS.check className="w-3.5 h-3.5 text-emerald-400" />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <aside aria-label="Order summary" className="flex-[1_1_340px] min-w-0 lg:sticky lg:top-6">
          <OrderSummary quote={quote} busy={busy} switching={setup.switching} onPay={pay} />
        </aside>
      </div>

      {/* On a phone the total and the button stay in view */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0c0d13]/95 backdrop-blur px-4 py-3 flex items-center gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-400">Due today</p>
          <p className="font-display text-xl font-bold text-white">{rupees(quote.today)}</p>
        </div>
        <button type="button" onClick={pay} disabled={busy || !quote.ready || quote.available.length === 0} className={`${BTN.primary} flex-1`}>
          {payLabelOf(quote, { busy, switching: setup.switching })}
        </button>
      </div>
    </div>
  );
}
