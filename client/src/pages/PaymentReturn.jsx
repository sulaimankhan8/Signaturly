import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Confetti from "../components/Confetti";
import PaymentProgress, { PaymentShell, panel } from "../components/PaymentProgress";
import { confirmCheckoutApi, checkoutStatusApi } from "../api/billing.api";
import { readPaymentReturn, clearPaymentReturn, rupees, rupeesFromPaise, PAYMENT_SHOWN } from "../utils/checkout";

/**
 * Where a customer lands after paying.
 *
 * The browser's word that a payment was made counts for nothing, so this page proves it:
 *   1. it hands the server what Razorpay signed, and the server checks the signature and
 *      reads the payment from Razorpay itself;
 *   2. it then asks the server whether the payment is in the account's record, and keeps
 *      asking for a short while, since Razorpay's own notice may be the one that completes it.
 * While that runs it shows what it is doing. When the record has the payment, it says so.
 *
 * What to check comes from utils/checkout.js, which leaves it in the tab's storage on the way
 * here. The customer arrives from the payment screen (components/PaymentFlow.jsx), which shows
 * the same card, so the two run together.
 */

const TRIES = 15;
const EVERY_MS = 2000;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const day = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

const primary =
  "inline-flex items-center justify-center px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_#facc15] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all";
const secondary = "inline-flex items-center justify-center px-5 py-3 bg-white/5 hover:bg-white/10 text-gray-100 rounded-xl text-xs font-bold border-2 border-white/15 transition-colors";

// The square mark at the top of the card, in the colour of how things stand
const Mark = ({ colour, shadow, children }) => (
  <div className={`mx-auto grid place-items-center w-16 h-16 rounded-2xl border-2 border-black text-3xl font-black ${colour}`} style={{ boxShadow: `4px 4px 0 0 ${shadow}` }} aria-hidden="true">
    {children}
  </div>
);

const Fact = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-2 border-b border-white/5 last:border-0">
    <dt className="text-[11px] uppercase font-black tracking-wider text-gray-500 shrink-0">{label}</dt>
    <dd className="text-sm font-bold text-white text-right min-w-0 break-words">{children}</dd>
  </div>
);

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
          if (info.nothingToday ? status.approved : status.recorded) {
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

  if (!info) return null;

  // Paid for from the plans and billing page itself (at either of its addresses): there is nowhere else to lead back to
  const backTo = info.from && !["/billing", "/pricing"].some((path) => info.from.startsWith(path)) ? info.from : null;
  const invoice = result?.invoice;
  const renewal = result?.renewal;
  const amount = invoice ? rupeesFromPaise(invoice.totalPaise) : info.amountInr ? rupees(info.amountInr) : "";
  const boughtPlan = result?.payment?.kind === "purchase" || info.nothingToday;
  const boughtDocuments = result?.payment?.kind === "topup";
  // A plan for a team is of no use until the team exists: that is the next thing to do
  const teamNext = boughtPlan && Boolean(result?.plan?.perSeat) && !backTo;

  return (
    <PaymentShell data-testid="payment-return">
      {stage === "checking" && <PaymentProgress doing={step} simulated={info.simulated} nothingToday={info.nothingToday} summary={[info.description, info.nothingToday ? "" : amount].filter(Boolean).join(" · ")} />}

      {stage === "done" && (
        <>
          <Confetti />
          <section className={`${panel} shadow-[6px_6px_0px_0px_#34d399] relative z-50`} role="status">
            <Mark colour="bg-emerald-500 text-black" shadow="#ffffff">
              ✓
            </Mark>
            <h1 className="text-2xl font-black text-white text-center mt-5">{info.nothingToday ? "Auto-renew is on" : "Payment confirmed"}</h1>
            <p className="text-sm text-gray-400 text-center mt-2">{info.nothingToday ? "Nothing was charged today. Your plan will now renew by itself." : "Thank you. It is on your account now."}</p>

            <dl className="mt-6 rounded-2xl bg-[#08090d] border-2 border-white/10 px-4 py-2">
              <Fact label={info.nothingToday ? "For" : "Paid for"}>{invoice?.description || info.description}</Fact>
              {!info.nothingToday && amount && <Fact label="Amount">{amount}</Fact>}
              {invoice?.number && <Fact label={invoice.kind === "tax_invoice" ? "Invoice" : "Receipt"}>{invoice.number}</Fact>}
              {boughtPlan && result?.plan?.name && <Fact label="Your plan">{result.plan.name}</Fact>}
              {boughtPlan && renewal?.mode === "auto" && (
                <Fact label="Renews">
                  {day(renewal.nextChargeOn)} · {rupees(renewal.amountInr)}
                </Fact>
              )}
              {boughtPlan && renewal?.mode === "once" && <Fact label="Paid until">{day(renewal.endsOn)}</Fact>}
              {result?.usage?.extraDocuments > 0 && <Fact label="Extra documents in hand">{result.usage.extraDocuments}</Fact>}
            </dl>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {backTo && (
                <Link to={backTo} className={primary}>
                  Back to what you were doing
                </Link>
              )}
              {teamNext && (
                <Link to="/workspaces" className={primary}>
                  Set up your team
                </Link>
              )}
              <Link to="/billing" className={backTo || teamNext ? secondary : primary}>
                Go to Billing
              </Link>
              {boughtDocuments && (
                <Link to="/billing#topups" className={secondary}>
                  Buy more documents
                </Link>
              )}
              <Link to="/dashboard" className={secondary}>
                Dashboard
              </Link>
            </div>
            {invoice && <p className="text-[11px] text-gray-500 text-center mt-4">The {invoice.kind === "tax_invoice" ? "invoice" : "receipt"} can be downloaded from your Billing page.</p>}
          </section>
        </>
      )}

      {stage === "pending" && (
        <section className={`${panel} shadow-[6px_6px_0px_0px_#facc15]`} role="status">
          <Mark colour="bg-yellow-400 text-black" shadow="#ffffff">
            …
          </Mark>
          <h1 className="text-2xl font-black text-white text-center mt-5">Your payment is being confirmed</h1>
          <p className="text-sm text-gray-300 text-center mt-2 leading-relaxed">
            The payment was made, and we have not finished confirming it with the bank yet. This can take a minute or two. You do not need to pay again: it will appear on your Billing page by itself.
          </p>
          {paymentId && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Payment reference: <span className="font-mono text-gray-300 break-all">{paymentId}</span>
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => setRound((n) => n + 1)} className={primary}>
              Check again
            </button>
            <Link to="/billing" className={secondary}>
              Go to Billing
            </Link>
          </div>
        </section>
      )}

      {stage === "failed" && (
        <section className={`${panel} shadow-[6px_6px_0px_0px_#ef4444]`} role="alert">
          <Mark colour="bg-red-600 text-white" shadow="#facc15">
            !
          </Mark>
          <h1 className="text-2xl font-black text-white text-center mt-5">We could not confirm this payment</h1>
          <p className="text-sm text-gray-300 text-center mt-2 leading-relaxed">{problem}</p>
          <p className="text-sm text-gray-400 text-center mt-3 leading-relaxed">
            Nothing has been added to your account. If money left your bank, it is matched to your account automatically when the bank reports it, or returned to you. You can check your Billing page in a few minutes.
          </p>
          {paymentId && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Payment reference: <span className="font-mono text-gray-300 break-all">{paymentId}</span>
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/billing" className={primary}>
              Back to Billing
            </Link>
            <a href="mailto:support@pactdoc.com" className={secondary}>
              Contact support
            </a>
          </div>
        </section>
      )}
    </PaymentShell>
  );
}
