import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Confetti from "../components/Confetti";
import PaymentProgress, { PaymentShell, panel, Mark, Step, Bought } from "../components/PaymentProgress";
import { downloadInvoice } from "../utils/invoices";
import { ICONS, BTN } from "../components/billing/theme";
import { confirmCheckoutApi, checkoutStatusApi } from "../api/billing.api";
import { readPaymentReturn, clearPaymentReturn, rupees, rupeesFromPaise, PAYMENT_SHOWN } from "../utils/checkout";
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

const Fact = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-white/[0.05] last:border-0">
    <dt className="text-sm text-gray-400 shrink-0">{label}</dt>
    <dd className="text-sm font-bold text-white text-right min-w-0 break-words">{children}</dd>
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
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-4 pr-3 py-2.5 rounded-xl bg-[#0d0e14] border border-white/[0.07]">
      <span className="text-[13px] text-gray-400 min-w-0">
        Payment reference <span className="ml-1.5 font-mono text-gray-100 break-all">{paymentId}</span>
      </span>
      <button type="button" onClick={copy} className={`${BTN.small} border border-white/[0.14] bg-white/5 hover:bg-white/10 text-gray-100`}>
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
          <section className={`${panel} border-emerald-400/35 shadow-[0_30px_80px_-40px_rgba(52,211,153,0.45)] relative z-50`} role="status">
            <Mark tone="green">
              <ICONS.check className="w-9 h-9" />
            </Mark>
            <h1 className="mt-6 text-center font-display text-[30px] font-bold tracking-tight text-white">{doneTitle}</h1>
            <p className="mt-2 mx-auto max-w-[460px] text-center text-gray-300">{doneLead}</p>

            <ul aria-label="What happened" className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-gray-400">
              {[info.nothingToday ? "Approved at Razorpay" : "Paid at Razorpay", "Checked it is genuine", info.nothingToday ? "Auto-renew turned on" : "Added to your account"].map((said) => (
                <li key={said} className="inline-flex items-center gap-1.5">
                  <ICONS.check className="w-3.5 h-3.5 text-emerald-400" />
                  {said}
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-[14px] bg-[#0d0e14] border border-white/[0.07] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.07]">
                <h2 className="text-sm font-bold text-white">Receipt</h2>
                {invoice?.id && (
                  <button type="button" onClick={() => downloadInvoice(invoice)} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-rose-300 hover:text-rose-200">
                    <ICONS.download className="w-4 h-4" />
                    Download {invoice.kind === "tax_invoice" ? "tax invoice" : "receipt"}
                  </button>
                )}
              </div>
              <dl className="px-4 py-1">
                <Fact label={info.nothingToday ? "For" : "Paid for"}>{invoice?.description || info.description}</Fact>
                {!info.nothingToday && amount && <Fact label="Amount">{amount}</Fact>}
                {invoice?.number && <Fact label={invoice.kind === "tax_invoice" ? "Invoice" : "Receipt"}>{invoice.number}</Fact>}
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
              </dl>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
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
            {invoice && <p className="mt-4 text-center text-[13px] text-gray-400">A copy of the {invoice.kind === "tax_invoice" ? "invoice" : "receipt"} is on its way to your email, and kept under Billing › Invoices.</p>}
          </section>
        </>
      )}

      {stage === "pending" && (
        <section className={`${panel} border-amber-400/35 shadow-[0_30px_80px_-40px_rgba(251,191,36,0.4)]`} role="status">
          <Mark tone="amber">
            <ICONS.clock className="w-9 h-9" />
          </Mark>
          <h1 className="mt-6 text-center font-display text-[28px] font-bold tracking-tight text-white">Paid, still confirming</h1>
          <p className="mt-2 mx-auto max-w-[460px] text-center text-gray-300">Your payment went through, but the final confirmation has not reached us yet. This usually takes a minute or two.</p>
          <div className="mt-5 flex gap-3 px-4 py-3.5 rounded-xl bg-amber-400/[0.08] border border-amber-400/30 text-sm text-amber-50">
            <ICONS.shield className="w-[18px] h-[18px] shrink-0 mt-0.5 text-amber-300" />
            <span>You do not need to pay again. It is added to your account by itself as soon as the confirmation arrives, and you will get an email then.</span>
          </div>
          <ol className="mt-5 px-4 py-1 rounded-[14px] bg-[#0d0e14] border border-white/[0.07]">
            <Step state="done">{info.nothingToday ? "Approved at Razorpay" : "Paid at Razorpay"}</Step>
            <Step state="done">Checked it is genuine</Step>
            <Step state="doing" spin="#fbbf24" status="Waiting">
              Waiting for the final confirmation
            </Step>
          </ol>
          <Bought description={info.description} amountInr={info.nothingToday ? null : info.amountInr} />
          <Reference paymentId={paymentId} />
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => setRound((n) => n + 1)} className={BTN.primary}>
              Check again
            </button>
            <Link to="/billing" className={BTN.secondary}>
              Go to Billing
            </Link>
          </div>
          <p className="mt-4 text-center text-[13px] text-gray-400">Still checking by itself. You can leave this page.</p>
        </section>
      )}

      {stage === "failed" && (
        <section className={`${panel} border-rose-500/40 shadow-[0_30px_80px_-40px_rgba(244,63,94,0.45)]`} role="alert">
          <Mark tone="red">
            <ICONS.alert className="w-9 h-9" />
          </Mark>
          <h1 className="mt-6 text-center font-display text-[28px] font-bold tracking-tight text-white">We could not confirm this payment</h1>
          <p className="mt-2 mx-auto max-w-[460px] text-center text-gray-300">{problem} Nothing was added to your account.</p>
          <div className="mt-5 flex gap-3 px-4 py-3.5 rounded-xl bg-rose-500/[0.08] border border-rose-500/30 text-sm text-rose-50">
            <ICONS.shield className="w-[18px] h-[18px] shrink-0 mt-0.5 text-rose-300" />
            <span>If money left your bank, it is matched to your account when the bank reports it, or returned to you. You can check your Billing page in a few minutes.</span>
          </div>
          <ol className="mt-5 px-4 py-1 rounded-[14px] bg-[#0d0e14] border border-white/[0.07]">
            <Step state="done">Payment made at Razorpay</Step>
            <Step state="failed" status="Failed">
              Did not match this order
            </Step>
            <Step state="waiting">Add it to your account</Step>
          </ol>
          <Bought description={info.description} amountInr={info.amountInr} />
          <Reference paymentId={paymentId} />
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Link to={retryAt} className={BTN.primary}>
              Try again
            </Link>
            <a href={`mailto:support@pactdoc.com?subject=${encodeURIComponent(`Payment ${paymentId || "not confirmed"}`)}`} className={BTN.secondary}>
              Contact support
            </a>
          </div>
          <p className="mt-4 text-center text-[13px] text-gray-400">Quote the payment reference if you write to us.</p>
        </section>
      )}
    </PaymentShell>
  );
}
