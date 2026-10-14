import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import PlanCheckout from "../components/PlanCheckout";
import PricingCards from "../components/PricingCards";
import { PRICING_FALLBACK, includedIn, people } from "../config/pricingFallback";
import { offersOf, offerOf, periodSaid, savingOn, savingSaid } from "../utils/plans";
import {
  fetchPlansApi,
  fetchUserSubscription,
  fetchWalletApi,
  fetchBillingProfileApi,
  saveBillingProfileApi,
  fetchInvoicesApi,
  downloadInvoiceApi,
  stopAutoRenewApi,
  devRenewApi,
} from "../api/billing.api";
import { payFor, rupees, rupeesFromPaise } from "../utils/checkout";

/**
 * Plans and billing: the one page for what PactDoc costs and for what an account has bought.
 * It is reached at /pricing (the public address, written out as HTML when the site is built)
 * and at /billing (where the app's own links and the payment emails lead); both are this page.
 *
 * A visitor sees the prices, and each button leads to creating an account. Someone signed in
 * sees the same page with their own account in it, and buys there and then.
 *
 * Three things are sold, and the page keeps them apart, in this order, top to bottom:
 *   1 Plan              a monthly allowance of documents, as a subscription or prepaid
 *   2 Extra documents   top-ups: one payment, at any time and on any plan
 *   3 Wallet            optional prepaid credit, only for SMS and WhatsApp messages
 * The three tiles at the top say how each stands and lead to its part of the page. Beneath
 * the three, for an account: every payment's invoice, and the details printed on them.
 *
 * The figures come from the server's price list, so the page cannot disagree with what
 * checkout charges. Everything bought here goes through the same checkout.
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

// What the page shows about renewal when the server does not say (an older server)
const NO_RENEWAL = { mode: "none", interval: null, overdue: false, canStart: false, canStop: false, canAddPeriod: false };
const NO_PROFILE = { legalName: "", address: "", gstin: "", stateCode: "" };

// State codes as GST uses them
const STATES = [
  ["27", "Maharashtra"], ["29", "Karnataka"], ["07", "Delhi"], ["33", "Tamil Nadu"], ["36", "Telangana"], ["24", "Gujarat"],
  ["19", "West Bengal"], ["09", "Uttar Pradesh"], ["08", "Rajasthan"], ["32", "Kerala"], ["06", "Haryana"], ["03", "Punjab"],
  ["23", "Madhya Pradesh"], ["37", "Andhra Pradesh"], ["10", "Bihar"], ["21", "Odisha"], ["18", "Assam"], ["20", "Jharkhand"],
  ["22", "Chhattisgarh"], ["05", "Uttarakhand"], ["02", "Himachal Pradesh"], ["30", "Goa"], ["01", "Jammu and Kashmir"], ["04", "Chandigarh"],
  ["34", "Puducherry"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"],
  ["16", "Tripura"], ["17", "Meghalaya"], ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["31", "Lakshadweep"], ["35", "Andaman and Nicobar Islands"], ["38", "Ladakh"],
];

const card = "bg-[#13151f] border-2 border-white/15 rounded-2xl p-5 sm:p-6 shadow-[4px_4px_0px_0px_#000]";
const tile = "bg-[#13151f] border-2 border-white/15 rounded-2xl p-5 flex flex-col";
const inputClass = "w-full px-3 py-2.5 bg-[#08090d] border-2 border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500";
const primary =
  "px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_#facc15] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all text-center";
const secondary = "px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none text-gray-100 rounded-xl text-xs font-bold border-2 border-white/15 transition-colors text-center";
const jump = "mt-auto pt-4 text-xs text-red-400 hover:text-red-300 underline underline-offset-2 font-black self-start inline-flex items-center gap-1.5 group transition-colors";
const day = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
const perMessage = (paise) => `₹${(paise / 100).toFixed(2)} a message`;

// The most packs of extra documents one payment can buy; the server holds to the same number
const MAX_PACKS = 20;

// The small label beside the plan's name that says how it stands
const PILL = {
  green: "bg-emerald-500 text-black",
  yellow: "bg-yellow-400 text-black",
  red: "bg-red-600 text-white",
  blue: "bg-sky-400 text-black",
  gray: "bg-gray-700 text-gray-100",
};

const YES = <span className="text-emerald-400 font-bold">✓</span>;
const NO = <span className="text-gray-600">—</span>;

// What each plan includes, a column for each plan on the price list. The rows an admin can
// change for a plan (its allowance, saving templates, bulk send, workspaces, the API) are
// read from the price list; the others follow the plan's level, and must stay true to
// services/entitlements.service.js on the server. A plan includes the same at either price.
const COMPARISON = (offers) => {
  const columns = offers.map(({ plan }) => ({ plan, ...includedIn(plan) }));
  const each = (say) => columns.map(say);
  const has = (feature) => each(({ features }) => (features[feature] ? YES : NO));
  return [
    ["Documents a month", ...each(({ plan }) => (plan.priceIsFrom ? "Agreed with you" : plan.documentsPerMonth ? `${plan.documentsPerMonth}${plan.perSeat ? " a seat, pooled" : ""}` : "No monthly limit"))],
    ["Extra documents when you run out", ...each(() => YES)],
    ["Sealed PDF with a signing record", ...each(() => YES)],
    ["Signing in English and Hindi", ...each(() => YES)],
    ["Ready-made templates", ...each(({ plan }) => (plan.tier === "free" ? "Starter pack" : plan.tier === "enterprise" ? "Every pack" : "Every Pro pack"))],
    ["Save your own templates", ...has("templates.own")],
    ["Bulk send", ...each(({ features, limits }) => (features.bulkSend ? `${people(limits.bulkSendMax)} at a time` : NO))],
    ["\"Signed with PactDoc\" line on your documents", ...each(({ plan }) => (plan.tier === "free" ? "Shown" : "Removed"))],
    ["Team workspaces, roles and invitations", ...has("workspaces")],
    ["Your name and logo for signers", ...has("workspaces")],
    ["API keys, webhooks and embedded signing", ...has("api")],
    ["Single sign-on", ...each(({ plan }) => (plan.tier === "enterprise" ? YES : NO))],
  ];
};

// The colour each column of the comparison is written in, by where the plan stands
const COLUMN_COLOURS = ["", "text-yellow-400", "text-purple-400", "text-blue-400"];

// The number that ties a tile at the top to its part of the page
const Step = ({ children }) => (
  <span className="grid place-items-center w-6 h-6 shrink-0 rounded-md bg-red-600 border-2 border-black text-white text-xs font-black" aria-hidden="true">
    {children}
  </span>
);

const TileLabel = ({ number, children }) => (
  <p className="flex items-center gap-2 text-[11px] uppercase font-black tracking-wider text-gray-400">
    <Step>{number}</Step>
    {children}
  </p>
);

// The heading of one of the three things sold: what it is called, how it is paid for, and what it is
const SectionHead = ({ number, title, paid, children }) => (
  <div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Step>{number}</Step>
      <h2 className="text-xl font-black text-white">{title}</h2>
      <span className="px-2 py-0.5 rounded-md border border-white/15 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-gray-300">{paid}</span>
    </div>
    <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">{children}</p>
  </div>
);

/**
 * How an account stands, worked out from what the server says about it: the plan it is on,
 * how that is paid for, and what the page says and offers because of it.
 */
const standingOf = (account, plans, offers) => {
  const { subscription, usage, entitlements } = account;
  const renewal = account.renewal || NO_RENEWAL;
  // The plan the account is really on now: a paid plan that has lapsed counts as Free
  const planId = entitlements.plan || subscription.plan;
  const currentPlan = plans.find((plan) => plan.id === planId);
  // A plan no longer sold is not in the catalogue, but the account still holds it
  const held = currentPlan || account.availablePlans?.[planId] || null;
  const planName = held?.name || planId;
  const paid = entitlements.tier !== "free";
  const period = renewal.interval === "year" ? "year" : "month";
  const seats = held?.perSeat ? subscription.seats || 1 : null;

  // How the plan stands: a word for the label, and a sentence saying what happens next
  const [tone, label, sentence] =
    renewal.mode === "auto"
      ? renewal.overdue
        ? ["red", "Payment overdue", `The automatic payment due on ${day(renewal.nextChargeOn)} has not gone through yet. It will be tried again; your plan stays on for a few days meanwhile.`]
        : ["green", "Subscription", `Renews automatically on ${day(renewal.nextChargeOn)} for ${rupees(renewal.amountInr)}.`]
      : renewal.mode === "once"
        ? renewal.overdue
          ? ["red", "Ended", `Your paid time ended on ${day(renewal.endsOn)}. Buy more time to keep the plan.`]
          : ["yellow", "Prepaid", `Paid until ${day(renewal.endsOn)}. It will not renew by itself.`]
        : paid
          ? ["blue", "Active", "This plan has no end date, and nothing is charged for it. You can move to another plan below."]
          : ["gray", "Free", "Choose a plan below when you need more documents or more features."];

  // What has been used of the month's allowance, as a share of the bar
  const share = usage.monthlyQuota ? Math.min(100, Math.round((usage.usedThisMonth / usage.monthlyQuota) * 100)) : 0;

  // A plan is one thing with a monthly and, where it has one, a yearly price (utils/plans.js)
  const myOffer = paid ? offerOf(offers, planId) : null;
  const renewing = renewal.mode === "auto";
  // The account's plan at its other price, where that is on sale: the same plan, paid for differently
  const otherPrice = myOffer && currentPlan ? (myOffer.yearly?.id === planId ? myOffer.plan : myOffer.yearly) : null;
  const canSwitchPeriod = Boolean(otherPrice?.purchasable) && renewal.mode !== "none" && (renewing ? otherPrice.billing?.subscription !== false : true);
  const switchSaves = otherPrice && otherPrice === myOffer.yearly ? savingSaid(savingOn(myOffer)) : "";

  // Moving to another plan while one is running: it starts today and takes the place of the present one
  const replacing = paid ? { name: planName, until: renewal.endsOn || renewal.nextChargeOn || null } : null;
  // The time already paid for, which the plan's other price carries on from
  const paidUntil = renewal.mode !== "none" && !renewal.overdue ? renewal.endsOn || renewal.nextChargeOn || null : null;

  return { usage, renewal, planId, currentPlan, held, planName, paid, period, seats, tone, label, sentence, share, myOffer, renewing, otherPrice, canSwitchPeriod, switchSaves, replacing, paidUntil };
};

export default function PlansBilling({ initial }) {
  const user = useSelector((state) => state.auth.user);
  const signedIn = Boolean(user);
  // The public price list: all a visitor needs, and what is shown until an account's own arrives
  const [priceList, setPriceList] = useState(() => initial || embedded());
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [profile, setProfile] = useState(NO_PROFILE);
  // The account's details could not be read; the page says so and offers to try again
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  // The step that asks how to pay for a plan: null, or what checkoutFor gives
  const [checkout, setCheckout] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // How many of each pack of extra documents are to be bought: pack id -> number
  const [packs, setPacks] = useState({});
  // An amount of wallet credit of the customer's own choosing, as typed
  const [walletAmount, setWalletAmount] = useState("");
  const { hash } = useLocation();

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
    setProfile({ ...NO_PROFILE, ...billingProfile });
  };

  const loadAccount = () => {
    setFailed(false);
    return load().catch(() => setFailed(true));
  };

  useEffect(() => {
    if (signedIn) {
      loadAccount();
      return;
    }
    // Signed out: nothing of an account stays on screen, and the public price list is enough
    setData(null);
    setWallet(null);
    setInvoices([]);
    setProfile(NO_PROFILE);
    if (!priceList) fetchPlansApi().then(setPriceList).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const account = signedIn && data && wallet ? data : null;
  const loading = signedIn && !account && !failed;
  const catalogue = account?.catalogue || priceList || null;
  const plans = catalogue?.plans?.length ? catalogue.plans : PRICING_FALLBACK.plans;
  const offers = offersOf(plans);
  const topups = catalogue?.topups || [];
  const walletPacks = catalogue?.walletPacks || [];
  const usagePrices = catalogue?.usagePricesPaise || null;
  const billingEnabled = account ? Boolean(account.billingEnabled) : true;
  const held = Boolean(busy) || !billingEnabled;
  const mine = account ? standingOf(account, plans, offers) : null;

  // A link to a part of the page ("Buy more documents" leads to #topups) is followed once the page is drawn
  const drawn = signedIn ? Boolean(account) || failed : true;
  useEffect(() => {
    if (drawn && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [drawn, hash]);

  // One payment for extra documents ("topup", any number of a pack: `quantity`) or wallet credit
  // ("wallet": a set amount, or "custom" with `amountInr`).
  // Once paid, the customer is on the page that confirms the payment; only a payment given up comes back here.
  const buy = async (kind, item, how = {}) => {
    try {
      setBusy(`${kind}:${item}`);
      const outcome = await payFor(kind, item, how);
      if (outcome === "cancelled") return;
      toast.success(outcome === "simulated" ? "Simulated payment applied." : outcome === "processing" ? "Payment received. It will show here in a moment." : "Payment received.");
      // Not confirmed yet: the provider's own notice reaches the server a moment later
      if (outcome === "processing") await new Promise((resolve) => setTimeout(resolve, 2500));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "The purchase could not be started.");
    } finally {
      setBusy("");
    }
  };

  // After a plan is paid for. One not confirmed yet is completed by the provider's own notice a moment later.
  const afterPlanPaid = async (outcome) => {
    setCheckout(null);
    if (searchParams.get("plan")) setSearchParams({}, { replace: true });
    if (outcome === "processing") await new Promise((resolve) => setTimeout(resolve, 2500));
    await load();
  };

  const stopRenewing = async (until) => {
    if (!window.confirm(`Turn off auto-renew?\n\nNothing more will be charged. Your plan stays as it is until ${day(until)} and then ends, unless you buy more time.`)) return;
    try {
      setBusy("renewal");
      const res = await stopAutoRenewApi();
      toast.success(res?.message || "Auto-renew is off.");
      await load();
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
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "The renewal could not be simulated.");
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

  // Wallet credit is bought as one amount, in any whole number of rupees between these. The set
  // amounts are not purchases of their own: each adds to the amount, and Buy pays for the total.
  const walletRange = catalogue?.walletCustom || null;
  const chosen = Number(walletAmount);
  const chosenFits = Boolean(walletRange) && Number.isInteger(chosen) && chosen >= walletRange.minInr && chosen <= walletRange.maxInr;
  const atMost = Boolean(walletRange) && chosen >= walletRange.maxInr;
  const addToAmount = (amountInr) => setWalletAmount((typed) => String(Math.min(walletRange.maxInr, Math.max(0, Math.floor(Number(typed)) || 0) + amountInr)));
  const addChosen = (event) => {
    event.preventDefault();
    if (!chosenFits) {
      toast.error(`Enter a whole amount from ${rupees(walletRange.minInr)} to ${rupees(walletRange.maxInr)}.`);
      return;
    }
    buy("wallet", "custom", { amountInr: chosen });
  };

  /**
   * What the checkout step is opened with for `record`, a plan at one of its prices.
   * Another plan starts today and replaces the present one. The account's own plan at its
   * other price keeps the time paid for; one that renews is switched in a single step.
   */
  const checkoutFor = (record, way) => {
    const offer = offerOf(offers, record.id);
    const same = Boolean(mine.myOffer) && offer === mine.myOffer;
    const switching = same && mine.renewing;
    return {
      plan: record,
      // Both prices of the plan are offered, so how often to pay can still be changed there
      plans: switching || !offer ? [record] : [offer.plan, offer.yearly].filter((price) => price?.purchasable),
      ways: switching ? ["auto"] : ["auto", "once"],
      prefer: way,
      paidUntil: same ? mine.paidUntil : null,
      replacing: same ? null : mine.replacing,
      switching,
      same,
    };
  };
  const choose = (record, way) => setCheckout(checkoutFor(record, way));
  const manage = (ways) =>
    setCheckout({ plan: mine.currentPlan, plans: [mine.currentPlan], ways, prefer: ways[0], paidUntil: mine.renewal.overdue ? null : mine.renewal.endsOn, replacing: null, switching: false, same: true });

  // A plan's "Get ..." button, pressed before signing in, names the plan to buy at one of its prices: /billing?plan=pro_annual
  const asked = searchParams.get("plan");
  const askedRecord = mine && asked && asked !== mine.planId ? plans.find((plan) => plan.id === asked && plan.purchasable) : null;
  const askedCheckout = askedRecord ? checkoutFor(askedRecord, "auto") : null;
  // A plan that renews is turned off before another is bought; its own other price is the one exception
  const open = mine ? checkout || (askedCheckout && (!mine.renewing || askedCheckout.switching) ? askedCheckout : null) : null;
  const closeCheckout = () => {
    setCheckout(null);
    if (asked) setSearchParams({}, { replace: true });
  };

  // What one document comes to in each pack, and which pack makes it cheapest
  const each = (pack) => pack.priceInr / pack.documents;
  const cheapest = topups.length > 1 ? Math.min(...topups.map(each)) : null;
  const freePlan = plans.find((plan) => plan.id === "free");
  const smallestPack = topups.length ? topups.reduce((least, pack) => (pack.priceInr < least.priceInr ? pack : least)) : null;

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      {signedIn && <Toaster position="top-right" />}
      {signedIn ? (
        <Navbar />
      ) : (
        <header className="border-b-2 border-white/15">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
            <Link to="/" className="text-xl font-black tracking-tight text-white">
              Pact<span className="text-red-500">Doc</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-3 py-2 text-xs font-bold text-gray-300 hover:text-white">
                Sign in
              </Link>
              <Link to="/register" className={primary}>
                Start free
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-12">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">{signedIn ? "Plans & billing" : "Plans and prices"}</h1>
          <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
            {signedIn
              ? "Your plan, extra documents, wallet and invoices, in one place. Prices are in rupees and include GST."
              : `Start free with ${freePlan?.documentsPerMonth ?? 5} documents a month. Prices are in rupees and include GST, with no charge per signer. A document is one PDF sent for signature, however many people sign it.`}
          </p>
        </div>

        {signedIn && account && !billingEnabled && (
          <p className="px-4 py-3 rounded-xl border-2 border-amber-400/40 bg-amber-400/10 text-amber-100 text-xs" role="status">
            Paid plans are not on sale yet. You can use the Free plan in the meantime.
          </p>
        )}

        {failed && (
          <div className="px-4 py-3 rounded-xl border-2 border-red-500/50 bg-red-500/10 text-red-100 text-sm flex flex-wrap items-center justify-between gap-3" role="alert">
            <span>Your billing details could not be loaded. The prices below are still right.</span>
            <button type="button" onClick={loadAccount} className={secondary}>
              Try again
            </button>
          </div>
        )}

        {/* The three things that are paid for, and how each stands */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr_1fr] gap-4">
          <section className={tile} data-testid="billing-plan">
            <TileLabel number="1">{signedIn ? "Your plan" : "Plan"}</TileLabel>
            {mine ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                  <p className="text-2xl font-black text-white">
                    {mine.planName}
                    {mine.paid && periodSaid(mine.held) && <span className="text-sm font-bold text-gray-400"> · {periodSaid(mine.held)}</span>}
                  </p>
                  <span className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-md border-2 border-black ${PILL[mine.tone]}`}>{mine.label}</span>
                  {mine.seats && (
                    <span className="text-xs text-gray-400 font-bold">
                      {mine.seats} seat{mine.seats === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mt-3 leading-relaxed" data-testid="billing-renewal">
                  {mine.sentence}
                </p>

                {/* What can be done about the plan, by how it is paid for now */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {mine.renewal.mode === "auto" && (
                    <>
                      <button onClick={() => stopRenewing(mine.renewal.nextChargeOn)} disabled={Boolean(busy)} className={secondary}>
                        Turn off auto-renew
                      </button>
                      <span className="text-xs text-gray-400">You keep the plan until that date either way.</span>
                      {account.devSimulation && (
                        <button onClick={simulateRenewal} disabled={Boolean(busy)} className="text-xs text-gray-400 underline hover:text-gray-200">
                          Simulate the next charge (development)
                        </button>
                      )}
                    </>
                  )}
                  {mine.renewal.mode === "once" && mine.currentPlan && mine.renewal.canStart && (
                    <button onClick={() => manage(["auto"])} disabled={held} className={primary}>
                      Turn on auto-renew
                    </button>
                  )}
                  {mine.renewal.mode === "once" && mine.currentPlan && mine.renewal.canAddPeriod && (
                    <button onClick={() => manage(["once"])} disabled={held} className={secondary}>
                      {mine.renewal.overdue ? `Pay for another ${mine.period}` : `Add another ${mine.period}`} · {rupees(mine.renewal.amountInr)}
                    </button>
                  )}
                  {mine.canSwitchPeriod && (
                    <button onClick={() => choose(mine.otherPrice, "auto")} disabled={held} className={secondary}>
                      Switch to {periodSaid(mine.otherPrice).toLowerCase()}
                      {mine.switchSaves ? ` · ${mine.switchSaves}` : ""}
                    </button>
                  )}
                </div>
                {mine.renewal.mode !== "auto" && (
                  <a href="#plans" className={jump}>
                    <span>{mine.paid ? "Change plan" : "See plans"}</span>
                    <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                  </a>
                )}
              </>
            ) : loading ? (
              <p className="text-sm text-gray-400 mt-3">Loading your plan…</p>
            ) : (
              <>
                <p className="text-lg font-black text-white mt-3">A monthly allowance of documents</p>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  Free gives you {freePlan?.documentsPerMonth ?? 5} documents a month. A paid plan gives more, as a subscription that renews by itself or prepaid for one month or year at a time.
                </p>
                <a href="#plans" className={jump}>
                  <span>See plans</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </>
            )}
          </section>

          <section className={tile} data-testid="billing-usage">
            <TileLabel number="2">{signedIn ? "Documents this month" : "Extra documents"}</TileLabel>
            {mine ? (
              <>
                <p className="text-2xl font-black text-white mt-3">
                  {mine.usage.usedThisMonth}
                  {mine.usage.monthlyQuota !== null && <span className="text-gray-400"> of {mine.usage.monthlyQuota}</span>}
                </p>
                {mine.usage.monthlyQuota !== null && (
                  <div className="mt-2 h-2.5 rounded bg-white/10 border border-white/10 overflow-hidden" aria-hidden="true">
                    <div className={`h-full ${mine.share >= 100 ? "bg-red-500" : mine.share >= 80 ? "bg-yellow-400" : "bg-emerald-400"}`} style={{ width: `${mine.share}%` }} />
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">{mine.usage.monthlyQuota === null ? "No monthly limit" : `Allowance renews on ${day(mine.usage.resetsOn)}`}</p>
                <p className={`text-sm font-bold mt-3 ${mine.usage.extraDocuments > 0 ? "text-emerald-300" : "text-gray-400"}`}>
                  {mine.usage.extraDocuments > 0 ? `${mine.usage.extraDocuments} extra documents in hand` : "No extra documents in hand"}
                </p>
                <a href="#topups" className={jump}>
                  <span>Buy extra documents</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </>
            ) : loading ? (
              <p className="text-sm text-gray-400 mt-3">Loading your documents…</p>
            ) : (
              <>
                <p className="text-lg font-black text-white mt-3">One payment when you run out</p>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  Used after the month&apos;s allowance, on any plan, and kept until you use them{smallestPack ? `. From ${rupees(smallestPack.priceInr)} for ${smallestPack.documents}` : ""}.
                </p>
                <a href="#topups" className={jump}>
                  <span>See the packs</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </>
            )}
          </section>

          <section className={tile}>
            <TileLabel number="3">Wallet</TileLabel>
            {mine ? (
              <>
                <p className="text-2xl font-black text-white mt-3">{rupeesFromPaise(wallet.balancePaise)}</p>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">Only for signing links sent by SMS or WhatsApp. Email is free, and plans are never paid from it.</p>
                <a href="#wallet" className={jump}>
                  <span>Add credit</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </>
            ) : loading ? (
              <p className="text-sm text-gray-400 mt-3">Loading your wallet…</p>
            ) : (
              <>
                <p className="text-lg font-black text-white mt-3">Optional credit for SMS and WhatsApp</p>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">Signing links by email are always free. The wallet pays only for links you choose to send by SMS or WhatsApp.</p>
                <a href="#wallet" className={jump}>
                  <span>See the prices</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </>
            )}
          </section>
        </div>

        {/* 1. Plans */}
        <section id="plans" className="scroll-mt-28 space-y-6">
          <SectionHead number="1" title="Plans" paid="Subscription or prepaid">
            A plan gives you a number of documents every month. <strong className="text-gray-200">Subscribe</strong> and it renews by itself until you turn that off, or <strong className="text-gray-200">prepay</strong> for one month or year at a time. You choose which when you pay.
          </SectionHead>

          {/* Mounted afresh when the account arrives, so the switch starts on how the account pays */}
          <PricingCards
            key={mine ? "account" : "visitor"}
            catalogue={catalogue}
            user={user}
            account={mine ? { currentPlanId: mine.planId, renews: mine.renewing, manageable: mine.renewal.mode !== "none", held, onChoose: choose } : null}
          />

          <details className={`${card} group`} open={!signedIn} data-testid="comparison">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-black text-white">
              <span>Compare what each plan includes</span>
              <span className="text-xs font-bold text-red-400 group-open:hidden">Show</span>
              <span className="text-xs font-bold text-red-400 hidden group-open:inline">Hide</span>
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b-2 border-white/10 text-gray-400">
                    <th className="py-2.5 px-3 font-black uppercase tracking-wider">Features</th>
                    {offers.map(({ plan }, index) => (
                      <th key={plan.id} className={`py-2.5 px-3 font-black uppercase tracking-wider text-center ${COLUMN_COLOURS[index] || ""}`}>
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {COMPARISON(offers).map(([feature, ...cells]) => (
                    <tr key={feature}>
                      <td className="py-2.5 px-3 font-semibold text-white">{feature}</td>
                      {cells.map((cell, index) => (
                        <td key={index} className={`py-2.5 px-3 text-center ${COLUMN_COLOURS[index] || ""} ${typeof cell === "string" ? "font-bold" : ""}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        {/* 2. Extra documents */}
        <section id="topups" className="scroll-mt-28 space-y-6" data-testid="billing-topups">
          <SectionHead number="2" title="Extra documents" paid="One payment">
            For a month when you send more than your plan allows. They are used after the monthly allowance, work on any plan including Free, and do not expire at month end. No wallet needed.
          </SectionHead>

          {topups.length === 0 ? (
            <p className="text-sm text-gray-400">{catalogue ? "No packs are on sale at the moment." : "Loading the packs…"}</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
              {topups.map((pack) => {
                const count = packs[pack.id] || 1;
                const total = rupees(pack.priceInr * count);
                const change = (by) => setPacks((old) => ({ ...old, [pack.id]: Math.min(MAX_PACKS, Math.max(1, count + by)) }));
                const best = cheapest !== null && each(pack) === cheapest;
                return (
                  <li key={pack.id} className={`flex flex-col rounded-2xl border-2 p-5 bg-[#13151f] transition-all ${best ? "border-yellow-400 shadow-[4px_4px_0px_0px_#ef4444]" : "border-white/15 shadow-[4px_4px_0px_0px_#000]"}`} data-testid={`topup-${pack.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-black text-white">{pack.documents} extra documents</p>
                      {best && <span className="px-2 py-0.5 text-[11px] font-black uppercase tracking-wider rounded border-2 border-black bg-yellow-400 text-black whitespace-nowrap">Best value</span>}
                    </div>
                    <p className="text-3xl font-black text-white font-mono mt-3">{rupees(pack.priceInr)}</p>
                    <p className="text-xs text-gray-400 mt-1">₹{each(pack).toFixed(2)} a document</p>

                    <div className="mt-auto pt-5 space-y-2">
                      {mine ? (
                        <>
                          {/* How many packs, for a larger top-up in one payment */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="inline-flex items-center rounded-xl border-2 border-white/15 overflow-hidden bg-[#08090d]" role="group" aria-label={`How many packs of ${pack.documents}`}>
                              <button type="button" onClick={() => change(-1)} disabled={count <= 1 || Boolean(busy)} aria-label="One pack fewer" className="w-9 h-9 text-white font-black hover:bg-white/10 active:bg-white/20 disabled:opacity-30">
                                −
                              </button>
                              <span className="w-8 text-center text-sm font-black text-white tabular-nums" aria-live="polite">
                                {count}
                              </span>
                              <button type="button" onClick={() => change(1)} disabled={count >= MAX_PACKS || Boolean(busy)} aria-label="One pack more" className="w-9 h-9 text-white font-black hover:bg-white/10 active:bg-white/20 disabled:opacity-30">
                                +
                              </button>
                            </div>
                            <span className="text-xs text-gray-400 text-right">{count > 1 ? `${count} packs, ${pack.documents * count} documents` : "1 pack"}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => buy("topup", pack.id, { quantity: count })}
                            disabled={held}
                            aria-label={`Buy ${count > 1 ? `${count} packs of ` : ""}${pack.documents} extra documents for ${total}`}
                            className={`${primary} w-full`}
                          >
                            {busy === `topup:${pack.id}` ? "Opening…" : `Buy · ${total}`}
                          </button>
                        </>
                      ) : signedIn ? (
                        <button type="button" disabled className={`${primary} w-full`}>
                          Buy · {total}
                        </button>
                      ) : (
                        // Not signed in: an account first, then back here to buy
                        <Link to="/register?next=%2Fbilling%23topups" className={`${primary} block w-full`} aria-label={`Buy ${pack.documents} extra documents for ${total}`}>
                          Buy · {total}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!signedIn && topups.length > 0 && <p className="text-xs text-gray-400">You will be asked to create an account first.</p>}
        </section>

        {/* 3. Wallet */}
        <section id="wallet" className="scroll-mt-28 space-y-6" data-testid="billing-wallet">
          <SectionHead number="3" title="Wallet" paid="Prepaid credit">
            Optional. Credit that pays only for signing links you send by SMS or WhatsApp; email is always free. Plans and extra documents are never paid from it, and nothing is added to it automatically.
          </SectionHead>

          <div className={`${card} grid grid-cols-1 md:grid-cols-2 gap-6`}>
            <div>
              {mine && (
                <>
                  <p className="text-[11px] uppercase font-black tracking-wider text-gray-400">Balance</p>
                  <p className="text-4xl font-black text-white mt-1.5" data-testid="wallet-balance">
                    {rupeesFromPaise(wallet.balancePaise)}
                  </p>
                </>
              )}
              <p className={`text-[11px] uppercase font-black tracking-wider text-gray-400 ${mine ? "mt-6" : ""}`}>What it pays for</p>
              <ul className="mt-2 divide-y divide-white/5 text-sm text-gray-300">
                <li className="flex justify-between gap-3 py-2">
                  <span>Signing link by email</span>
                  <span className="font-black text-emerald-300">Free</span>
                </li>
                {usagePrices && (
                  <>
                    <li className="flex justify-between gap-3 py-2">
                      <span>Signing link by SMS</span>
                      <span className="font-black text-white">{perMessage(usagePrices.sms)}</span>
                    </li>
                    <li className="flex justify-between gap-3 py-2">
                      <span>Signing link by WhatsApp</span>
                      <span className="font-black text-white">{perMessage(usagePrices.whatsapp)}</span>
                    </li>
                  </>
                )}
              </ul>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed">SMS and WhatsApp delivery are being set up and are not switched on yet. Credit you add stays in your wallet until you use it.</p>
            </div>

            <div className="md:border-l-2 md:border-white/10 md:pl-6">
              {!mine ? (
                signedIn ? (
                  <p className="text-sm text-gray-400">{loading ? "Loading your wallet…" : "Your wallet could not be loaded."}</p>
                ) : (
                  <>
                    <p className="text-[11px] uppercase font-black tracking-wider text-gray-400">Add credit</p>
                    <p className="text-sm text-gray-300 mt-2 leading-relaxed">
                      Add any whole amount{walletRange ? `, from ${rupees(walletRange.minInr)}` : ""}, when you need it. An account comes first.
                    </p>
                    <Link to="/register?next=%2Fbilling%23wallet" className={`${secondary} inline-block mt-4`}>
                      Create an account to add credit
                    </Link>
                  </>
                )
              ) : walletRange ? (
                <form onSubmit={addChosen} data-testid="wallet-custom" noValidate>
                  <label htmlFor="wallet-amount" className="block text-[11px] uppercase font-black tracking-wider text-gray-400">
                    Amount to add
                  </label>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-xl bg-[#08090d] border-2 border-white/15 focus-within:border-red-500 pl-3">
                      <span className="text-sm font-black text-gray-400" aria-hidden="true">
                        ₹
                      </span>
                      <input
                        id="wallet-amount"
                        type="number"
                        inputMode="numeric"
                        min={walletRange.minInr}
                        max={walletRange.maxInr}
                        step="1"
                        placeholder="0"
                        value={walletAmount}
                        onChange={(e) => setWalletAmount(e.target.value)}
                        aria-describedby="wallet-amount-help"
                        className="w-32 px-2 py-2.5 bg-transparent text-white text-base font-bold placeholder-gray-600 focus:outline-none"
                      />
                    </div>
                    {walletAmount !== "" && (
                      <button type="button" onClick={() => setWalletAmount("")} disabled={Boolean(busy)} className="px-2 py-2 text-xs font-bold text-gray-400 hover:text-white underline underline-offset-2 disabled:opacity-40">
                        Clear
                      </button>
                    )}
                  </div>
                  {/* Each of these adds to the amount above; nothing is paid until Buy */}
                  <div className="mt-3 flex flex-wrap gap-2" data-testid="wallet-quick">
                    {walletPacks.map((pack) => (
                      <button key={pack.id} type="button" onClick={() => addToAmount(pack.amountInr)} disabled={held || atMost} aria-label={`Add ${rupees(pack.amountInr)} to the amount`} className={secondary}>
                        + {rupees(pack.amountInr)}
                      </button>
                    ))}
                  </div>
                  <p id="wallet-amount-help" className="text-xs text-gray-400 mt-2">
                    Tap to add to the amount, or type one: a whole amount from {rupees(walletRange.minInr)} to {rupees(walletRange.maxInr)}.
                  </p>
                  <button type="submit" disabled={held || !chosenFits} className={`${primary} mt-4`} data-testid="wallet-buy">
                    {busy === "wallet:custom" ? "Opening…" : chosenFits ? `Buy ${rupees(chosen)} of credit` : "Buy credit"}
                  </button>
                </form>
              ) : (
                // A server that sells only the set amounts: each is its own purchase
                <>
                  <p className="text-[11px] uppercase font-black tracking-wider text-gray-400">Add credit</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {walletPacks.map((pack) => (
                      <button key={pack.id} onClick={() => buy("wallet", pack.id)} disabled={held} className={secondary}>
                        Add {rupees(pack.amountInr)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {mine && wallet.entries.length > 0 && (
              <div className="md:col-span-2 border-t-2 border-white/10 pt-4">
                <p className="text-[11px] uppercase font-black tracking-wider text-gray-400">Wallet activity</p>
                <ul className="mt-2 space-y-1 text-xs text-gray-400 max-h-40 overflow-y-auto">
                  {wallet.entries.map((entry) => (
                    <li key={entry.reference} className="flex justify-between gap-3">
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
              </div>
            )}
          </div>
        </section>

        {mine && (
          <>
            {/* Invoices */}
            <section id="invoices" className={`${card} scroll-mt-28`} data-testid="billing-invoices">
              <h2 className="text-lg font-black text-white">Invoices</h2>
              <p className="text-xs text-gray-400 mt-1">Every payment has one: plans, renewals, extra documents and wallet credit.</p>
              {invoices.length === 0 ? (
                <p className="text-sm text-gray-400 mt-3">No payments yet.</p>
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

            {/* Details for invoices */}
            <section className={card}>
              <h2 className="text-lg font-black text-white">Details for your invoices</h2>
              <p className="text-xs text-gray-400 mt-1">Add your GST number if you want it on your invoices. Invoices already issued do not change.</p>
              <form onSubmit={saveProfile} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-gray-400 space-y-1">
                  <span>Name on the invoice</span>
                  <input className={inputClass} value={profile.legalName} maxLength={120} onChange={(e) => setProfile({ ...profile, legalName: e.target.value })} />
                </label>
                <label className="text-xs text-gray-400 space-y-1">
                  <span>GST number (optional)</span>
                  <input
                    className={`${inputClass} uppercase`}
                    value={profile.gstin}
                    maxLength={15}
                    placeholder="27ABCDE1234F1Z5"
                    onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
                  />
                </label>
                <label className="text-xs text-gray-400 space-y-1 md:col-span-2">
                  <span>Address</span>
                  <input className={inputClass} value={profile.address} maxLength={300} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                </label>
                <label className="text-xs text-gray-400 space-y-1">
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
                  <button type="submit" disabled={savingProfile} className={secondary}>
                    Save details
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </main>

      {open && (
        <PlanCheckout
          key={`${open.plan.id}:${open.ways.join()}:${open.prefer}`}
          open
          plans={open.plans}
          planId={open.plan.id}
          ways={open.ways}
          prefer={open.prefer}
          addOns={topups}
          paidUntil={open.paidUntil}
          replacing={open.replacing}
          switching={open.switching}
          seats={open.plan.perSeat ? mine.seats || 3 : null}
          // The account's own plan keeps the seats it has, at either price
          chooseSeats={open.plan.perSeat && !open.same}
          maxSeats={catalogue?.maxSeats}
          onClose={closeCheckout}
          onDone={afterPlanPaid}
        />
      )}
    </div>
  );
}
