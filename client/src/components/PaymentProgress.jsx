import { Link } from "react-router-dom";
import { rupees } from "../utils/checkout";
import { ICONS } from "./billing/theme";

/**
 * The screen a customer sees from the moment they choose to pay until the payment is in their
 * account: one card, with the three things that happen in order, which of them is under way,
 * and what is being bought.
 *
 * It is shown twice without a break between: first behind Razorpay's window while the customer
 * pays (components/PaymentFlow.jsx), then on the page that confirms the payment
 * (pages/PaymentReturn.jsx). Both draw it from here, so one runs into the other.
 */

export const panel = "w-full max-w-[620px] bg-[#12141c] border rounded-[22px] px-6 sm:px-8 pt-9 pb-7";

const Ring = ({ colour, track, children }) => (
  <div className="relative w-[76px] h-[76px] grid place-items-center mx-auto" aria-hidden="true">
    <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: "1s" }} viewBox="0 0 76 76" fill="none">
      <circle cx="38" cy="38" r="34" stroke={track} strokeWidth="4" />
      <path d="M72 38a34 34 0 0 0-34-34" stroke={colour} strokeWidth="4" strokeLinecap="round" />
    </svg>
    {children}
  </div>
);

// The square mark at the top of the card, in the colour of how things stand
export const Mark = ({ tone, children }) => {
  const tones = {
    green: "bg-gradient-to-br from-emerald-400 to-emerald-500 text-[#04130d] shadow-[0_0_0_10px_rgba(52,211,153,0.12)]",
    amber: "bg-amber-400/[0.14] border border-amber-400/40 text-amber-300",
    red: "bg-rose-500/[0.14] border border-rose-500/45 text-rose-300",
  };
  return (
    <div className={`mx-auto w-[76px] h-[76px] rounded-[22px] grid place-items-center ${tones[tone]}`} aria-hidden="true">
      {children}
    </div>
  );
};

// The page behind the card: the same dark ground and header, wherever it is shown
export const PaymentShell = ({ children, className = "", ...rest }) => (
  <div className={`min-h-screen bg-[#0a0b10] text-gray-100 font-sans flex flex-col ${className}`} {...rest}>
    <header className="border-b border-white/[0.07] bg-[#0c0d13]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-5">
        <Link to="/dashboard" className="font-display text-[21px] font-bold tracking-tight text-white">
          Pact<span className="text-rose-500">Doc</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-400">
          <ICONS.lock className="w-3.5 h-3.5" /> Secure checkout
        </span>
      </div>
    </header>
    <main className="flex-1 w-full flex flex-col items-center px-4 py-12 sm:py-14">{children}</main>
  </div>
);

// One line of what is happening: done, under way, still to come, or failed
export const Step = ({ state, spin = "#a78bfa", children, status }) => (
  <li className={`flex items-center gap-3 py-[11px] text-sm ${state === "waiting" ? "text-gray-500" : state === "failed" ? "text-rose-200" : "text-gray-100"} ${state === "doing" ? "font-bold" : ""}`}>
    {state === "done" ? (
      <span className="w-[22px] h-[22px] shrink-0 grid place-items-center rounded-[7px] bg-emerald-400 text-[#04130d]" aria-hidden="true">
        <ICONS.check className="w-[13px] h-[13px]" />
      </span>
    ) : state === "doing" ? (
      <svg className="w-[22px] h-[22px] shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke={spin} strokeWidth="3" strokeLinecap="round" />
      </svg>
    ) : state === "failed" ? (
      <span className="w-[22px] h-[22px] shrink-0 grid place-items-center rounded-[7px] bg-rose-500 text-white" aria-hidden="true">
        <ICONS.close className="w-3 h-3" />
      </span>
    ) : (
      <span className="w-[22px] h-[22px] shrink-0 rounded-[7px] border-[1.5px] border-white/20" aria-hidden="true" />
    )}
    <span className="flex-1">{children}</span>
    {status && <span className="text-xs font-medium text-gray-400">{status}</span>}
  </li>
);

// What is being bought, and for how much
export const Bought = ({ description, amountInr }) =>
  description || amountInr ? (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3.5 rounded-xl border border-dashed border-white/[0.14]">
      <span className="text-sm text-gray-300 min-w-0">{description}</span>
      {amountInr ? <span className="font-display text-lg font-bold text-white">{rupees(amountInr)}</span> : null}
    </div>
  ) : null;

const stateOf = (index, doing) => (index < doing ? "done" : index === doing ? "doing" : "waiting");
const PROGRESS = ["18%", "52%", "82%"];

/**
 * `doing` is which of the three steps is under way: 0 paying, 1 checking the payment is
 * genuine, 2 adding it to the account.
 * `simulated` is a purchase with no payment provider behind it (development).
 * `nothingToday` is a subscription turned on with nothing charged today.
 * `description` and `amountInr` say what is being bought and for how much.
 */
export default function PaymentProgress({ doing, simulated = false, nothingToday = false, description = "", amountInr = null }) {
  const paying = doing === 0;
  return (
    <section className={`${panel} border-white/[0.09] shadow-[0_30px_80px_-40px_rgba(139,92,246,0.45)]`} role="status" aria-live="polite">
      {paying ? (
        <Ring colour="#a78bfa" track="rgba(167,139,250,0.18)">
          <ICONS.card className="w-7 h-7 text-violet-300" />
        </Ring>
      ) : (
        <Ring colour="#fbbf24" track="rgba(251,191,36,0.16)">
          <ICONS.shield className="w-7 h-7 text-amber-300" />
        </Ring>
      )}

      <h1 className="mt-6 text-center font-display text-[28px] font-bold tracking-tight text-white">{paying ? (nothingToday ? "Approve auto-renew" : "Complete your payment") : "Confirming your payment"}</h1>
      <p className="mt-2 mx-auto max-w-[460px] text-center text-gray-300">
        {paying
          ? simulated
            ? "This page moves on by itself when the payment is made."
            : "The Razorpay window is open. Pay there by UPI, card or netbanking, and this page moves on by itself."
          : "This takes a few seconds. Please keep this page open, and don't pay again."}
      </p>

      {paying && !simulated && (
        <div className="mt-5 flex gap-3 px-4 py-3.5 rounded-xl bg-violet-400/[0.08] border border-violet-400/30 text-sm text-violet-100">
          <ICONS.phone className="w-[18px] h-[18px] shrink-0 mt-0.5 text-violet-300" />
          <span>
            Paying by UPI? Open your UPI app and approve the request from <strong className="text-white">PactDoc</strong>. Keep this tab open.
          </span>
        </div>
      )}

      <div className="mt-6 h-1.5 rounded-full bg-white/[0.07] overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-amber-300 transition-[width] duration-700" style={{ width: PROGRESS[doing] || "18%" }} />
      </div>
      <ol className="mt-4 px-4 py-1 rounded-[14px] bg-[#0d0e14] border border-white/[0.07]">
        <Step state={stateOf(0, doing)}>
          {simulated ? (paying ? "Simulating the payment" : "Simulated payment made") : paying ? (nothingToday ? "Approving auto-renew at Razorpay" : "Paying at Razorpay") : nothingToday ? "Auto-renew approved at Razorpay" : "Paid at Razorpay"}
        </Step>
        <Step state={stateOf(1, doing)}>{doing > 1 ? "Checked it is genuine" : "Checking it is genuine"}</Step>
        <Step state={stateOf(2, doing)}>{nothingToday ? "Turning on auto-renew" : "Adding it to your account"}</Step>
      </ol>

      <Bought description={description} amountInr={nothingToday ? null : amountInr} />

      <p className="mt-5 text-center text-[13px] text-gray-400">{paying ? "Payments are taken by Razorpay. PactDoc never sees your card or UPI details." : "We check every payment with Razorpay before turning anything on."}</p>
    </section>
  );
}
