import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Confetti from "../components/Confetti";
import PaymentProgress, { PaymentShell, panel, Mark, Step, Bought, STEPS } from "../components/PaymentProgress";
import { downloadInvoice } from "../utils/invoices";
import { ICONS, BTN, EYEBROW } from "../components/billing/theme";
import { Note } from "../components/billing/ui";
import { confirmCheckoutApi, checkoutStatusApi } from "../api/billing.api";
import { readPaymentReturn, clearPaymentReturn, rupees, rupeesFromPaise, PAYMENT_SHOWN, SETUP_CHECK_INR } from "../utils/checkout";
import { day } from "../utils/billing";

/**
 * Where a customer lands after paying.
 *
 * The browser's word that a payment was made counts for nothing, so this page proves it:
 *   1. it hands the server what Razorpay signed, and the server checks the signature and
 *      reads the payment from Razorpay itself;
 *   2. it then asks the server whether the payment is in the account's record, and keeps
 *      asking for a short while, since Razorpay's own notice may be the one that completes it.
 * While that runs it shows what it is doing. When the record has the payment, it says so,
 * with the receipt and what to do next.
 *
 * If the record still does not have it after that while, the payment was made and only its
 * confirmation is late: the page says not to pay again, and keeps asking quietly for a few
 * minutes more. The payment's email is sent the moment it is recorded, whenever that is.
 *
 * What to check comes from utils/checkout.js, which leaves it in the tab's storage on the way
 * here. The customer arrives from the payment screen (components/PaymentFlow.jsx), which shows
 * the same card, so the two run together.
 */

const TRIES = 15;
const EVERY_MS = 2000;
// Once the page has said the confirmation is late, it keeps asking this often, this many times
const LATE_EVERY_MS = 10000;
const LATE_TRIES = 18;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The card is in two halves on a laptop, so it fits on one screen: what happened and what to do
// next on the left, the receipt (or where the payment stands) on the right
const WIDE = "max-w-[940px] overflow-hidden";
const SPLIT = "grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]";
const SIDE = "p-6 sm:p-8 flex flex-col";
const RECEIPT = "p-6 sm:p-8 bg-[#0f1118] border-t-2 md:border-t-0 md:border-l-2 border-dashed border-white/15 flex flex-col";
const TITLE = "mt-6 text-3xl sm:text-4xl leading-[1.05] font-black uppercase tracking-tight text-white";

const Fact = ({ label, mono = false, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-white/[0.07] last:border-0">
    <dt className="text-sm text-gray-400 shrink-0">{label}</dt>
    <dd className={`text-right min-w-0 break-all text-white ${mono ? "font-mono text-xs font-bold" : "text-sm font-black"}`}>{children}</dd>
  </div>
);

// The payment's reference at Razorpay, to quote to us, with a button that copies it
const Reference = ({ paymentId }) => {
  const [copied, setCopied] = useState(false);
  if (!paymentId) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(paymentId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-4 pr-3 py-2.5 rounded-xl bg-[#090a0f] border-2 border-white/15">
      <span className="text-xs text-gray-400 min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-wider">Payment reference</span>
        <span className="font-mono font-bold text-gray-100 break-all">{paymentId}</span>
      </span>
      <button type="button" onClick={copy} className={BTN.small}>
        <ICONS.copy className="w-3.5 h-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
};

export default function PaymentReturn() {
  const navigate = useNavigate();
  const [info] = useState(() => readPaymentReturn());
  // "checking": at work. "done": in the record. "pending": paid, not in the record yet. "failed": could not be confirmed.
  const [stage, setStage] = useState("checking");
  // Which step is under way while checking: 1 the payment is being checked, 2 the record is being asked
  const [step, setStep] = useState(1);
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState("");
  const [round, setRound] = useState(0);

  const paymentId = info?.returned?.razorpay_payment_id || info?.paymentId || "";
  const subscriptionId = info?.returned?.razorpay_subscription_id || info?.subscriptionId || "";
  const arrived = (status) => (info?.nothingToday ? status.approved : status.recorded);

  // This page is on screen: the payment screen that led here can step aside
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(PAYMENT_SHOWN));
  }, []);

  useEffect(() => {
    // Opened by itself, with no payment to check: Billing is where to be
    if (!info) {
      navigate("/billing", { replace: true });
      return undefined;
    }
    // Leaving the page, or asking again, stops the check that is under way
    let stopped = false;

    const check = async () => {
      setStage("checking");
      setStep(1);

      // 1. The server checks Razorpay's signature and reads the payment from Razorpay
      if (info.returned) {
        try {
          await confirmCheckoutApi(info.returned);
        } catch (err) {
          const status = err.response?.status;
          // Refused outright: the signature is not Razorpay's, or the payment is another account's
          if (status === 400 || status === 403) {
            if (stopped) return;
            setProblem(err.response?.data?.message || "That payment could not be confirmed.");
            setStage("failed");
            return;
          }
          // Anything else (a slow network, Razorpay not answering) is not a refusal: the record is still asked below
        }
      }
      if (stopped) return;
      setStep(2);

      // 2. The record is asked until it has the payment
      for (let i = 0; i < TRIES && !stopped; i++) {
        try {
          const status = await checkoutStatusApi({ paymentId, subscriptionId });
          // A subscription that takes nothing today has no payment to find; it is done once it is marked as renewing
          if (arrived(status)) {
            if (stopped) return;
            setResult(status);
            setStage("done");
            clearPaymentReturn();
            return;
          }
        } catch {
          // A failed ask is asked again
        }
        await pause(EVERY_MS);
      }
      if (!stopped) setStage("pending");
    };

    check();
    return () => {
      stopped = true;
    };
    // `round` is what asks for another check
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Late: keep asking quietly, and move on by itself when the payment arrives
  useEffect(() => {
    if (stage !== "pending") return undefined;
    let stopped = false;
    (async () => {
      for (let i = 0; i < LATE_TRIES && !stopped; i++) {
        await pause(LATE_EVERY_MS);
        if (stopped) return;
        try {
          const status = await checkoutStatusApi({ paymentId, subscriptionId });
          if (!stopped && arrived(status)) {
            setResult(status);
            setStage("done");
            clearPaymentReturn();
            return;
          }
        } catch {
          // Asked again next time
        }
      }
    })();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (!info) return null;

  // Paid for from Billing or the pricing page: there is nowhere else to lead back to
  const backTo = info.from && !["/billing", "/pricing"].some((path) => info.from.startsWith(path)) ? info.from : null;
  // Where to try again after a payment that could not be confirmed
  const retryAt = info.from || "/billing";
  const invoice = result?.invoice;
  const renewal = result?.renewal;
  const amount = invoice ? rupeesFromPaise(invoice.totalPaise) : info.amountInr ? rupees(info.amountInr) : "";
  const boughtPlan = result?.payment?.kind === "purchase" || info.nothingToday;
  const boughtDocuments = result?.payment?.kind === "topup";
  // A plan for a team is of no use until the team exists: that is the next thing to do
  const teamNext = boughtPlan && Boolean(result?.plan?.perSeat) && !backTo;

  // What was done, in a heading and a sentence: an upgrade paid for by unused time, a move to a
  // cheaper plan that waits for the paid time to end, auto-renew turned on, or a payment
  const scheduled = renewal?.scheduled;
  const [doneTitle, doneLead] =
    info.change === "upgrade" && info.nothingToday
      ? [`You're on ${result?.plan?.name || "your new plan"}`, `Nothing was charged today: your unused time pays for it until ${day(renewal?.nextChargeOn || info.startsOn)}. After that it renews by itself.`]
      : info.change === "downgrade"
        ? ["Your plan change is set", `${scheduled?.name || "Your new plan"} starts on ${day(scheduled?.from || info.startsOn)}, and renews by itself from then. You keep ${result?.plan?.name || "your present plan"} until that day.`]
        : info.nothingToday
          ? ["Auto-renew is on", "Nothing was charged today. Your plan will now renew by itself."]
          : ["Payment confirmed", boughtPlan && result?.plan?.name ? `${result.plan.name} is active on your account now.` : "Thank you. It is on your account now."];

  return (
    <PaymentShell data-testid="payment-return">
      {stage === "checking" && <PaymentProgress doing={step} simulated={info.simulated} nothingToday={info.nothingToday} description={info.description} amountInr={info.amountInr} />}

      {stage === "done" && (
        <>
          <Confetti />
          <section className={`${panel} ${WIDE} border-emerald-500 shadow-[8px_8px_0px_0px_#22c55e] relative z-50`} role="status">
            <div className={SPLIT}>
              <div className={SIDE}>
                <Mark tone="green">
                  <ICONS.check className="w-8 h-8" />
                </Mark>
                <h1 className={TITLE}>{doneTitle}</h1>
                <p className="mt-3 text-gray-300 leading-relaxed">{doneLead}</p>

                <ol aria-label="What happened" className={`mt-5 ${STEPS}`}>
                  {[info.nothingToday ? "Approved at Razorpay" : "Paid at Razorpay", "Checked it is genuine", info.nothingToday ? "Auto-renew turned on" : "Added to your account"].map((said) => (
                    <Step key={said} state="done">
                      {said}
                    </Step>
                  ))}
                </ol>

                <div className="mt-6 flex flex-wrap gap-3">
                  {backTo && (
                    <Link to={backTo} className={BTN.primary}>
                      Back to what you were doing
                    </Link>
                  )}
                  {teamNext && (
                    <Link to="/workspaces" className={BTN.primary}>
                      <ICONS.users className="w-4 h-4" />
                      Set up your team
                    </Link>
                  )}
                  {boughtPlan && !backTo && !teamNext && (
                    <Link to="/upload" className={BTN.primary}>
                      <ICONS.send className="w-4 h-4" />
                      Send a document
                    </Link>
                  )}
                  <Link to="/billing" className={backTo || teamNext || boughtPlan ? BTN.secondary : BTN.primary}>
                    Go to Billing
                  </Link>
                  {boughtDocuments && !backTo && (
                    <Link to="/dashboard" className={BTN.secondary}>
                      Dashboard
                    </Link>
                  )}
                </div>
              </div>

              <aside aria-labelledby="receipt-heading" className={RECEIPT}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="receipt-heading" className={`${EYEBROW} inline-flex items-center gap-2`}>
                    <ICONS.receipt className="w-4 h-4 text-gray-400" />
                    Receipt
                  </h2>
                  {invoice?.id && (
                    <button type="button" onClick={() => downloadInvoice(invoice)} className={BTN.small}>
                      <ICONS.download className="w-3.5 h-3.5 text-red-400" />
                      Download {invoice.kind === "tax_invoice" ? "tax invoice" : "receipt"}
                    </button>
                  )}
                </div>

                {/* The amount, stamped, as a paper receipt would have it */}
                <div className="mt-5 flex items-end justify-between gap-3 pb-4 border-b-2 border-dashed border-white/15">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{info.nothingToday ? "Charged today" : "Amount paid"}</p>
                    <p className="text-4xl leading-tight font-black text-white tabular-nums">{info.nothingToday ? rupees(0) : amount}</p>
                    {info.nothingToday && !info.simulated && <p className="mt-1 text-xs text-gray-400">The ₹{SETUP_CHECK_INR} Razorpay took to set up auto-renew is refunded by itself.</p>}
                  </div>
                  <span className="mb-1.5 -rotate-6 px-2.5 py-0.5 rounded-md border-[3px] border-emerald-400 text-emerald-400 text-sm font-black uppercase tracking-[0.2em] select-none" aria-hidden="true">
                    {info.nothingToday ? "Approved" : "Paid"}
                  </span>
                </div>

                <dl>
                  <Fact label={info.nothingToday ? "For" : "Paid for"}>{invoice?.description || info.description}</Fact>
                  {invoice?.number && (
                    <Fact label={invoice.kind === "tax_invoice" ? "Invoice" : "Receipt"} mono>
                      {invoice.number}
                    </Fact>
                  )}
                  {boughtPlan && result?.plan?.name && (
                    <Fact label="Your plan">
                      {result.plan.name}
                      {result.plan.seats ? ` · ${result.plan.seats} seat${result.plan.seats === 1 ? "" : "s"}` : ""}
                    </Fact>
                  )}
                  {boughtPlan && renewal?.mode === "auto" && (
                    <Fact label="Renews">
                      {day(renewal.nextChargeOn)} · {rupees(renewal.amountInr)}
                    </Fact>
                  )}
                  {boughtPlan && renewal?.mode === "once" && <Fact label="Paid until">{day(renewal.endsOn)}</Fact>}
                  {result?.usage?.extraDocuments > 0 && <Fact label="Extra documents in hand">{result.usage.extraDocuments}</Fact>}
                  {paymentId && (
                    <Fact label="Payment reference" mono>
                      {paymentId}
                    </Fact>
                  )}
                </dl>
                {invoice && (
                  <p className="mt-auto pt-4 flex items-start gap-2 text-xs text-gray-400">
                    <ICONS.shieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    A copy of the {invoice.kind === "tax_invoice" ? "invoice" : "receipt"} is on its way to your email, and kept under Billing › Invoices.
                  </p>
                )}
              </aside>
            </div>
          </section>
        </>
      )}

      {stage === "pending" && (
        <section className={`${panel} ${WIDE} border-yellow-400 shadow-[8px_8px_0px_0px_#facc15]`} role="status">
          <div className={SPLIT}>
            <div className={SIDE}>
              <Mark tone="amber">
                <ICONS.clock className="w-8 h-8" />
              </Mark>
              <h1 className={TITLE}>Paid, still confirming</h1>
              <p className="mt-3 text-gray-300 leading-relaxed">Your payment went through, but the final confirmation has not reached us yet. This usually takes a minute or two.</p>
              <Note tone="amber" icon="shield" className="mt-5">
                You do not need to pay again. It is added to your account by itself as soon as the confirmation arrives, and you will get an email then.
              </Note>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => setRound((n) => n + 1)} className={BTN.primary}>
                  Check again
                </button>
                <Link to="/billing" className={BTN.secondary}>
                  Go to Billing
                </Link>
              </div>
              <p className="mt-4 text-xs text-gray-400">Still checking by itself. You can leave this page.</p>
            </div>

            <aside aria-label="Where the payment stands" className={RECEIPT}>
              <h2 className={EYEBROW}>Where it stands</h2>
              <ol className={`mt-3 ${STEPS}`}>
                <Step state="done">{info.nothingToday ? "Approved at Razorpay" : "Paid at Razorpay"}</Step>
                <Step state="done">Checked it is genuine</Step>
                <Step state="doing" status="Waiting">
                  Waiting for the final confirmation
                </Step>
              </ol>
              <Bought description={info.description} amountInr={info.nothingToday ? null : info.amountInr} />
              <Reference paymentId={paymentId} />
            </aside>
          </div>
        </section>
      )}

      {stage === "failed" && (
        <section className={`${panel} ${WIDE} border-red-500 shadow-[8px_8px_0px_0px_#ef4444]`} role="alert">
          <div className={SPLIT}>
            <div className={SIDE}>
              <Mark tone="red">
                <ICONS.alert className="w-8 h-8" />
              </Mark>
              <h1 className={TITLE}>We could not confirm this payment</h1>
              <p className="mt-3 text-gray-300 leading-relaxed">{problem} Nothing was added to your account.</p>
              <Note tone="red" icon="shield" className="mt-5">
                If money left your bank, it is matched to your account when the bank reports it, or returned to you. You can check your Billing page in a few minutes.
              </Note>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={retryAt} className={BTN.primary}>
                  Try again
                </Link>
                <a href={`mailto:support@pactdoc.com?subject=${encodeURIComponent(`Payment ${paymentId || "not confirmed"}`)}`} className={BTN.secondary}>
                  Contact support
                </a>
              </div>
              <p className="mt-4 text-xs text-gray-400">Quote the payment reference if you write to us.</p>
            </div>

            <aside aria-label="Where the payment stands" className={RECEIPT}>
              <h2 className={EYEBROW}>Where it stands</h2>
              <ol className={`mt-3 ${STEPS}`}>
                <Step state="done">Payment made at Razorpay</Step>
                <Step state="failed" status="Failed">
                  Did not match this order
                </Step>
                <Step state="waiting">Add it to your account</Step>
              </ol>
              <Bought description={info.description} amountInr={info.amountInr} />
              <Reference paymentId={paymentId} />
            </aside>
          </div>
        </section>
      )}
    </PaymentShell>
  );
}
