import { Link } from "react-router-dom";
import { rupees, SETUP_CHECK } from "../utils/checkout";
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

// The card everything sits on; each screen adds its own width, border colour and hard shadow
export const panel = "w-full bg-[#13151f] border-2 rounded-2xl";

const Ring = ({ colour, track, children }) => (
  <div className="relative w-[72px] h-[72px] grid place-items-center mx-auto" aria-hidden="true">
    <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: "1s" }} viewBox="0 0 76 76" fill="none">
      <circle cx="38" cy="38" r="34" stroke={track} strokeWidth="5" />
      <path d="M72 38a34 34 0 0 0-34-34" stroke={colour} strokeWidth="5" strokeLinecap="round" />
    </svg>
    {children}
  </div>
);

// The square mark at the top of the card, in the colour of how things stand
export const Mark = ({ tone, className = "", children }) => {
  const tones = {
    green: "bg-emerald-500 text-black shadow-[4px_4px_0px_0px_#ffffff]",
    amber: "bg-yellow-400 text-black shadow-[4px_4px_0px_0px_#ef4444]",
    red: "bg-red-600 text-white shadow-[4px_4px_0px_0px_#ffffff]",
  };
  return (
    <div className={`w-16 h-16 shrink-0 rounded-2xl border-2 border-black grid place-items-center ${tones[tone]} ${className}`} aria-hidden="true">
      {children}
    </div>
  );
};

/**
 * The bar above checkout and the payment screens: the app's mark, as the navbar draws it, and
 * a word that this is a secure place to pay. `children` sits on the right (a way back).
 */
export const CheckoutHeader = ({ children }) => (
  <header className="sticky top-0 z-40 bg-[#090a0f]/95 backdrop-blur-xl border-b-2 border-white/20">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4 min-w-0">
        <Link to="/dashboard" className="flex items-center gap-2.5 group select-none">
          <span className="w-9 h-9 grid place-items-center rounded-xl bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#ffffff] group-hover:rotate-[-2deg] transition-transform" aria-hidden="true">
            <ICONS.brand className="w-[18px] h-[18px]" />
          </span>
          <span className="text-lg font-black text-white tracking-tight">
            Pact<span className="text-red-500">Doc</span>
          </span>
        </Link>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border-2 border-emerald-500/60 bg-emerald-500/10 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
          <ICONS.lock className="w-3 h-3" /> Secure checkout
        </span>
      </div>
      {children}
    </div>
  </header>
);

// The page behind the card: the same dark ground and header, wherever it is shown
export const PaymentShell = ({ children, className = "", ...rest }) => (
  <div className={`min-h-screen bg-[#08090d] text-gray-100 font-sans flex flex-col selection:bg-red-600 selection:text-white ${className}`} {...rest}>
    <CheckoutHeader />
    <main className="flex-1 w-full flex flex-col items-center justify-center px-4 py-8 sm:py-10">{children}</main>
  </div>
);

// One line of what is happening: done, under way, still to come, or failed
export const Step = ({ state, spin = "#facc15", children, status }) => (
  <li className={`flex items-center gap-3 py-2.5 text-sm ${state === "waiting" ? "text-gray-500" : state === "failed" ? "text-red-300" : "text-gray-100"} ${state === "doing" || state === "failed" ? "font-black" : "font-bold"}`}>
    {state === "done" ? (
      <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md border-2 border-black bg-emerald-500 text-black" aria-hidden="true">
        <ICONS.check className="w-3.5 h-3.5" />
      </span>
    ) : state === "doing" ? (
      <svg className="w-6 h-6 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke={spin} strokeWidth="3" strokeLinecap="round" />
      </svg>
    ) : state === "failed" ? (
      <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md border-2 border-black bg-red-600 text-white" aria-hidden="true">
        <ICONS.close className="w-3.5 h-3.5" />
      </span>
    ) : (
      <span className="w-6 h-6 shrink-0 rounded-md border-2 border-white/20" aria-hidden="true" />
    )}
    <span className="flex-1">{children}</span>
    {status && <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{status}</span>}
  </li>
);

// The list the steps sit in
export const STEPS = "px-4 py-1 rounded-xl bg-[#090a0f] border-2 border-white/15 divide-y divide-white/[0.06]";

// What is being bought, and for how much
export const Bought = ({ description, amountInr }) =>
  description || amountInr ? (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 rounded-xl border-2 border-dashed border-white/20">
      <span className="text-sm font-medium text-gray-300 min-w-0">{description}</span>
      {amountInr ? <span className="text-lg font-black text-white tabular-nums">{rupees(amountInr)}</span> : null}
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
    <section className={`${panel} max-w-[560px] px-6 sm:px-8 py-8 border-white/20 shadow-[6px_6px_0px_0px_#facc15]`} role="status" aria-live="polite">
      {paying ? (
        <Ring colour="#facc15" track="rgba(250,204,21,0.15)">
          <ICONS.card className="w-7 h-7 text-yellow-400" />
        </Ring>
      ) : (
        <Ring colour="#22c55e" track="rgba(34,197,94,0.15)">
          <ICONS.shield className="w-7 h-7 text-emerald-400" />
        </Ring>
      )}

      <h1 className="mt-5 text-center text-2xl sm:text-[28px] font-black uppercase tracking-tight text-white">{paying ? (nothingToday ? "Approve auto-renew" : "Complete your payment") : "Confirming your payment"}</h1>
      <p className="mt-2 mx-auto max-w-[440px] text-center text-sm text-gray-300">
        {paying
          ? simulated
            ? "This page moves on by itself when the payment is made."
            : "The Razorpay window is open. Pay there by UPI, card or netbanking, and this page moves on by itself."
          : "This takes a few seconds. Please keep this page open, and don't pay again."}
      </p>

      {paying && !simulated && (
        <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-purple-500/60 bg-purple-500/[0.08] text-sm text-purple-50">
          <span className="w-7 h-7 shrink-0 grid place-items-center rounded-lg border-2 border-black bg-purple-600 text-white" aria-hidden="true">
            <ICONS.phone className="w-4 h-4" />
          </span>
          <span>
            Paying by UPI? Open your UPI app and approve the request from <strong className="text-white">PactDoc</strong>. Keep this tab open.
            {nothingToday && ` ${SETUP_CHECK}`}
          </span>
        </div>
      )}

      <div className="mt-6 h-3.5 rounded-md border-2 border-white/20 bg-[#090a0f] overflow-hidden" aria-hidden="true">
        <div className="h-full bg-yellow-400 transition-[width] duration-700" style={{ width: PROGRESS[doing] || "18%" }} />
      </div>
      <ol className={`mt-4 ${STEPS}`}>
        <Step state={stateOf(0, doing)}>
          {simulated ? (paying ? "Simulating the payment" : "Simulated payment made") : paying ? (nothingToday ? "Approving auto-renew at Razorpay" : "Paying at Razorpay") : nothingToday ? "Auto-renew approved at Razorpay" : "Paid at Razorpay"}
        </Step>
        <Step state={stateOf(1, doing)}>{doing > 1 ? "Checked it is genuine" : "Checking it is genuine"}</Step>
        <Step state={stateOf(2, doing)}>{nothingToday ? "Turning on auto-renew" : "Adding it to your account"}</Step>
      </ol>

      <Bought description={description} amountInr={nothingToday ? null : amountInr} />

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
        <ICONS.shieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        {paying ? "Payments are taken by Razorpay. PactDoc never sees your card or UPI details." : "We check every payment with Razorpay before turning anything on."}
      </p>
    </section>
  );
}
