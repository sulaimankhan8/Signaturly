import { Link } from "react-router-dom";

/**
 * The screen a customer sees from the moment they choose to pay until the payment is in their
 * account: one card, with the three things that happen in order and which of them is under way.
 *
 * It is shown twice without a break between: first behind Razorpay's window while the customer
 * pays (components/PaymentFlow.jsx), then on the page that confirms the payment
 * (pages/PaymentReturn.jsx). Both draw it from here, so one runs into the other.
 */

export const panel = "w-full max-w-lg bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8";

export const Spinner = ({ className = "w-5 h-5" }) => <span className={`${className} inline-block rounded-full border-[3px] border-white/15 border-t-yellow-400 animate-spin`} aria-hidden="true" />;

// The page behind the card: the same dark ground and the name, wherever it is shown
export const PaymentShell = ({ children, className = "", ...rest }) => (
  <div className={`min-h-screen bg-[#08090d] text-gray-100 font-sans flex flex-col items-center justify-center px-4 py-10 ${className}`} {...rest}>
    <Link to="/dashboard" className="mb-8 text-2xl font-black tracking-tight text-white">
      Pact<span className="text-red-500">Doc</span>
    </Link>
    {children}
  </div>
);

// One line of what is happening: done, under way, or still to come
const Step = ({ state, children }) => (
  <li className={`flex items-center gap-3 text-sm ${state === "waiting" ? "text-gray-500" : "text-gray-100"}`}>
    {state === "done" ? (
      <span className="grid place-items-center w-5 h-5 rounded-md bg-emerald-500 border-2 border-black text-black text-[11px] font-black" aria-hidden="true">
        ✓
      </span>
    ) : state === "doing" ? (
      <Spinner />
    ) : (
      <span className="w-5 h-5 rounded-md border-2 border-white/15" aria-hidden="true" />
    )}
    <span className={state === "doing" ? "font-bold" : ""}>{children}</span>
  </li>
);

const stateOf = (index, doing) => (index < doing ? "done" : index === doing ? "doing" : "waiting");

/**
 * `doing` is which of the three steps is under way: 0 paying, 1 checking the payment is
 * genuine, 2 adding it to the account.
 * `simulated` is a purchase with no payment provider behind it (development).
 * `nothingToday` is a subscription turned on with nothing charged today.
 * `summary` is a line saying what is being bought and for how much.
 */
export default function PaymentProgress({ doing, simulated = false, nothingToday = false, summary = "" }) {
  const paying = doing === 0;
  return (
    <section className={`${panel} shadow-[6px_6px_0px_0px_#facc15]`} role="status" aria-live="polite">
      <div className="flex justify-center">
        <Spinner className="w-14 h-14" />
      </div>
      <h1 className="text-2xl font-black text-white text-center mt-5">{paying ? "Complete your payment" : "Confirming your payment"}</h1>
      <p className="text-sm text-gray-400 text-center mt-2">{paying ? (simulated ? "This page moves on by itself when the payment is made." : "Pay in the Razorpay window. This page moves on by itself when you are done.") : "This takes a few seconds. Please keep this page open."}</p>

      <ol className="mt-6 space-y-3 rounded-2xl bg-[#08090d] border-2 border-white/10 p-4">
        <Step state={stateOf(0, doing)}>{simulated ? (paying ? "Simulating the payment" : "Simulated payment made") : paying ? (nothingToday ? "Approving auto-renew at Razorpay" : "Paying at Razorpay") : nothingToday ? "Auto-renew approved at Razorpay" : "Payment made at Razorpay"}</Step>
        <Step state={stateOf(1, doing)}>Checking it is genuine</Step>
        <Step state={stateOf(2, doing)}>{nothingToday ? "Turning on auto-renew" : "Adding it to your account"}</Step>
      </ol>

      {summary && <p className="text-xs text-gray-500 text-center mt-5">{summary}</p>}
    </section>
  );
}
