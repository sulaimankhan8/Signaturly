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
import { Note, Spinner, Assurances } from "../../components/billing/ui";
import { BTN, PANEL, ICONS } from "../../components/billing/theme";
import { CheckoutHeader } from "../../components/PaymentProgress";

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
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">Create an account to continue</h1>
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
        <button type="button" onClick={load} className="font-black underline underline-offset-2">
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
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <CheckoutHeader>
        <Link to={user ? "/billing/plans" : "/pricing"} className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white">
          <ICONS.back className="w-4 h-4" />
          Back to plans
        </Link>
      </CheckoutHeader>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-7 pb-32 lg:pb-14">{body}</main>
    </div>
  );
}

const Loading = () => (
  <div className="py-24 grid place-items-center" role="status" aria-label="Loading checkout">
    <Spinner className="w-10 h-10" />
  </div>
);

const Steps = () => (
  <ol aria-label="Progress" className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wider text-gray-500">
    <li className="inline-flex items-center gap-2 text-gray-300">
      <span className="w-6 h-6 grid place-items-center rounded-md border-2 border-black bg-emerald-500 text-black" aria-hidden="true">
        <ICONS.check className="w-3.5 h-3.5" />
      </span>
      Choose plan
    </li>
    <li className="w-8 h-0.5 bg-white/20" aria-hidden="true" />
    <li aria-current="step" className="inline-flex items-center gap-2 text-white">
      <span className="w-6 h-6 grid place-items-center rounded-md border-2 border-black bg-red-600 text-white text-xs shadow-[2px_2px_0px_0px_#facc15]" aria-hidden="true">
        2
      </span>
      Review &amp; pay
    </li>
    <li className="w-8 h-0.5 bg-white/20" aria-hidden="true" />
    <li className="inline-flex items-center gap-2">
      <span className="w-6 h-6 grid place-items-center rounded-md border-2 border-white/20 text-xs" aria-hidden="true">
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
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">That plan is not on sale</h1>
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
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">You are already on {record.name}</h1>
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
      <h1 className="mt-4 text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">{title}</h1>
      <p className="mt-1 text-sm font-medium text-gray-300">{quote.documents}. Prices include GST.</p>

      <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="min-w-0 grid gap-5">
          {notice === "cancelled" && (
            <Note tone="gray" icon="info" role="status" testId="checkout-cancelled">
              <strong className="text-white">Payment not completed.</strong> Nothing was charged, and your choices are kept. Press pay to try again; in the Razorpay window you can also switch to UPI, another card or netbanking.
            </Note>
          )}

          {setup.recovering && (
            <Note tone="red" icon="alert" testId="checkout-recovering">
              <strong className="text-white">Your automatic payment did not go through.</strong> Pay here to keep {plan.name}: with auto-renew you approve your UPI or card again and are charged today, or you pay for one {plan.interval}. Either takes the place of the payment that failed, so you are never charged twice.
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
              <h2 id="details-heading" className="flex items-center gap-2.5 text-sm font-black uppercase tracking-wider text-white">
                <span className="w-6 h-6 grid place-items-center rounded-md border-2 border-black bg-[#1e2235] text-gray-200" aria-hidden="true">
                  <ICONS.receipt className="w-3.5 h-3.5" />
                </span>
                Invoice details
              </h2>
              {!editing && (
                <button type="button" onClick={() => setEditing(true)} className={BTN.small}>
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
              <p className="mt-2 text-sm font-bold text-gray-200">
                {[shownProfile.legalName, shownProfile.gstin && `GSTIN ${shownProfile.gstin}`, stateName(shownProfile.gstin ? shownProfile.gstin.slice(0, 2) : shownProfile.stateCode)].filter(Boolean).join(" · ")}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-400">Buying for a business? Add your GST number to claim input tax credit.</p>
            )}
            <p className="mt-2 text-xs text-gray-400">Your tax invoice is emailed to {email || "you"} and kept under Billing › Invoices.</p>
          </section>

          <Assurances items={["Prices include GST", "No charge per signer", "Cancel auto-renew any time", "GST invoice for every payment"]} className="px-1" />
        </div>

        <aside aria-label="Order summary" className="min-w-0 lg:sticky lg:top-24">
          <OrderSummary quote={quote} busy={busy} switching={setup.switching} onPay={pay} />
        </aside>
      </div>

      {/* On a phone the total and the button stay in view */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t-2 border-white/20 bg-[#090a0f]/95 backdrop-blur px-4 py-3 flex items-center gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Due today</p>
          <p className="text-xl font-black text-white tabular-nums">{rupees(quote.today)}</p>
        </div>
        <button type="button" onClick={pay} disabled={busy || !quote.ready || quote.available.length === 0} className={`${BTN.primary} flex-1`}>
          {payLabelOf(quote, { busy, switching: setup.switching })}
        </button>
      </div>
    </div>
  );
}
