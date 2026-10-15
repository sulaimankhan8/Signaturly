import { startCheckoutApi, devPayApi, confirmCheckoutApi } from "../api/billing.api";

// Money as the app shows it: Rs. 1,25,000
export const rupees = (amount) => `₹${new Intl.NumberFormat("en-IN").format(amount)}`;
/**
 * Auto-renew that starts later (an upgrade paid for by unused time, a plan that waits for paid
 * time to end) charges nothing for the plan today, but Razorpay checks the UPI mandate or card
 * with a small payment that it refunds by itself, and says so on its own screen. Ours says it
 * first, beside "Due today", so the customer is not surprised by it.
 */
export const SETUP_CHECK_INR = 5;
export const SETUP_CHECK = `Razorpay takes a refundable ₹${SETUP_CHECK_INR} to set up auto-renew. It comes back to you by itself.`;

export const rupeesFromPaise = (paise) => `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)}`;

// What the page shown after paying has to check, kept for this tab only on the way there
const RETURN_KEY = "pactdoc_payment_return";
export const RETURN_PATH = "/billing/return";

/**
 * What a purchase says as it goes along. components/PaymentFlow.jsx listens: it covers the app
 * with the payment screen while the customer pays, and moves on to the confirming page when
 * they have. pages/PaymentReturn.jsx says when it is on screen.
 */
export const PAYMENT_STARTED = "pactdoc:payment-started";
export const PAYMENT_ENDED = "pactdoc:payment-ended";
export const PAYMENT_PAID = "pactdoc:payment-paid";
export const PAYMENT_SHOWN = "pactdoc:payment-shown";
const say = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

export const readPaymentReturn = () => {
  try {
    return JSON.parse(sessionStorage.getItem(RETURN_KEY) || "null");
  } catch {
    return null;
  }
};
export const clearPaymentReturn = () => {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing to clear where storage is not allowed
  }
};

/**
 * Hands over to the page that confirms a payment (pages/PaymentReturn.jsx), with what it
 * needs: what Razorpay handed back, what was being bought, and where the customer was.
 * The screen the customer is on gives way to that page, so whoever was waiting here is never answered.
 */
const leaveForReturnPage = (details, from) => {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ ...details, from, at: Date.now() }));
  } catch {
    // Without storage the return page has nothing to check and sends the customer on to Billing
  }
  say(PAYMENT_PAID);
  return new Promise(() => {});
};

const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("The payment window could not be loaded. Check your connection and try again."));
    document.body.appendChild(script);
  });

/**
 * Buys something on the price list: a plan ("plan"), extra documents ("topup"), wallet credit
 * ("wallet") or more seats ("seats", where the item is how many). A plan sold by the seat takes
 * the number of seats in `seats`. A plan is prepaid for one period unless `renew` is "auto",
 * which makes it a subscription: the customer approves that once in the payment window. A
 * plan can take a pack of extra documents with it (`addOn`), in the same payment. A pack of
 * extra documents bought by itself can be bought several at a time (`quantity`). Wallet
 * credit of the customer's own choosing is the item "custom" with its amount in `amountInr`.
 *
 * The browser decides nothing. After payment, Razorpay's signed answer goes to the server,
 * which checks it and applies what was paid for.
 *
 * What the customer sees depends on `stay`:
 *   left out   from the moment this is called the app is covered by the payment screen, and
 *              once the customer has paid they are on the page that confirms the payment
 *              (pages/PaymentReturn.jsx), with nothing else shown in between. Nothing is
 *              resolved then, since the screen they were on is gone.
 *   true       the customer stays where they are, for a purchase made in the middle of
 *              something else (out of documents while sending). The payment is confirmed
 *              here and the result is resolved.
 *
 * Resolves to:
 *   "cancelled"   the customer closed the payment window, or declined the simulation
 * and, with `stay`:
 *   "simulated"   development only: no payment provider is set up and the purchase was simulated
 *   "paid"        the payment was confirmed and what was bought is on the account
 *   "processing"  the customer paid, and the server has not confirmed it yet; it appears once
 *                 the provider's own notice reaches the server, usually within seconds
 */
export const payFor = async (kind, item, { seats, renew, addOn, quantity, amountInr: chosenInr, stay = false } = {}) => {
  const what = { seats, renew, addOn, quantity, amountInr: chosenInr };
  // Where the customer is now, so the confirming page can lead back (to the same checkout, after a failure)
  const from = `${window.location.pathname}${window.location.search}`;
  // The payment screen goes up at once, before anything is asked of the server
  if (!stay) say(PAYMENT_STARTED, { paid: false });

  try {
    const order = await startCheckoutApi(kind, item, what);
    // A plan that renews by itself is a subscription at the provider, not a single order
    const renews = order.mode === "subscription";
    const nothingToday = Boolean(renews && order.startsOn);
    // How a plan takes over from the one the account is on: "upgrade" or "downgrade" (services/planChange.service.js)
    const change = order.change === "upgrade" || order.change === "downgrade" ? order.change : undefined;
    const amountInr = order.isMock ? order.amount : order.amountPaise / 100;
    if (!stay) say(PAYMENT_STARTED, { description: order.description, amountInr: nothingToday ? 0 : amountInr, simulated: Boolean(order.isMock), nothingToday });

    if (order.isMock) {
      const asked = renews
        ? `Simulate approving "${order.description}" at ${rupees(order.amount)}${order.startsOn ? `, first charged on ${new Date(order.startsOn).toLocaleDateString("en-IN")}` : ""}?`
        : `Simulate paying ${rupees(order.amount)} for "${order.description}"?`;
      const agreed = window.confirm(`Development mode: no payment provider is set up.\n\n${asked}`);
      if (!agreed) {
        if (!stay) say(PAYMENT_ENDED);
        return "cancelled";
      }
      const done = await devPayApi(kind, item, what);
      if (stay) return "simulated";
      say(PAYMENT_STARTED, { paid: true });
      return leaveForReturnPage({ simulated: true, paymentId: done?.paymentId || "", subscriptionId: done?.subscriptionId || "", description: order.description, amountInr, nothingToday, change, startsOn: order.startsOn || null, kind }, from);
    }

    const Razorpay = await loadRazorpay();
    // Razorpay's window also closes after a payment; that is not the customer giving up
    let paid = false;
    return await new Promise((resolve) => {
      new Razorpay({
        key: order.keyId,
        ...(renews ? { subscription_id: order.subscriptionId } : { order_id: order.orderId, amount: order.amountPaise, currency: order.currency }),
        name: "PactDoc",
        description: order.description,
        prefill: { name: order.customer?.name, email: order.customer?.email },
        handler: (returned) => {
          paid = true;
          if (!stay) {
            // Razorpay's window closes now; the payment screen beneath it moves to its next step
            say(PAYMENT_STARTED, { paid: true });
            leaveForReturnPage({ returned, description: order.description, amountInr, nothingToday, change, startsOn: order.startsOn || null, kind }, from);
            return;
          }
          confirmCheckoutApi(returned)
            .then((result) => resolve(result?.confirmed ? "paid" : "processing"))
            .catch(() => resolve("processing"));
        },
        modal: {
          ondismiss: () => {
            if (paid) return;
            if (!stay) say(PAYMENT_ENDED);
            resolve("cancelled");
          },
        },
      }).open();
    });
  } catch (err) {
    // Could not be started: the customer is back where they were, and is told why there
    if (!stay) say(PAYMENT_ENDED);
    throw err;
  }
};
