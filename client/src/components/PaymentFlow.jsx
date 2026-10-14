import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PaymentProgress, { PaymentShell } from "./PaymentProgress";
import { PAYMENT_STARTED, PAYMENT_ENDED, PAYMENT_PAID, PAYMENT_SHOWN, RETURN_PATH } from "../utils/checkout";

/**
 * Takes the customer from "Buy" to the page that confirms the payment without the page they
 * were on showing through in between.
 *
 * The moment a purchase starts, this covers the app with the payment screen, and Razorpay's
 * window opens over it. When the customer has paid, it moves to the confirming page inside
 * the app, with no reload, and steps aside once that page is on screen. If the customer
 * closes Razorpay's window without paying, it steps aside and they are where they were.
 *
 * utils/checkout.js says when each of those happens. `preload` fetches the confirming page's
 * code as the purchase starts, so there is nothing to wait for when it is needed.
 */
export default function PaymentFlow({ preload }) {
  const navigate = useNavigate();
  // What is being paid for while the screen is up, or null when it is not
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    const started = (event) => {
      setPaying((old) => ({ ...old, ...event.detail }));
      preload?.();
    };
    const ended = () => setPaying(null);
    // Paid: on to the confirming page. This screen stays until that page says it is showing.
    const paid = () => navigate(RETURN_PATH);

    window.addEventListener(PAYMENT_STARTED, started);
    window.addEventListener(PAYMENT_ENDED, ended);
    window.addEventListener(PAYMENT_PAID, paid);
    window.addEventListener(PAYMENT_SHOWN, ended);
    return () => {
      window.removeEventListener(PAYMENT_STARTED, started);
      window.removeEventListener(PAYMENT_ENDED, ended);
      window.removeEventListener(PAYMENT_PAID, paid);
      window.removeEventListener(PAYMENT_SHOWN, ended);
    };
  }, [navigate, preload]);

  if (!paying) return null;

  return (
    // Above everything the app draws, and beneath Razorpay's own window
    <PaymentShell className="fixed inset-0 z-[70] overflow-y-auto" data-testid="payment-flow">
      <PaymentProgress doing={paying.paid ? 1 : 0} simulated={paying.simulated} nothingToday={paying.nothingToday} description={paying.description} amountInr={paying.amountInr} />
    </PaymentShell>
  );
}
