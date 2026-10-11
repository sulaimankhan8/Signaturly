import { startCheckoutApi, devPayApi } from "../api/billing.api";

// Money as the app shows it: Rs. 1,25,000
export const rupees = (amount) => `₹${new Intl.NumberFormat("en-IN").format(amount)}`;
export const rupeesFromPaise = (paise) => `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)}`;

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
 * the number of seats in `seats`.
 *
 * Resolves to:
 *   "simulated"  development only: no payment provider is set up and the purchase was simulated
 *   "paid"       the customer completed payment; what they bought appears once the provider confirms it
 *   "cancelled"  the customer closed the payment window, or declined the simulation
 */
export const payFor = async (kind, item, { seats } = {}) => {
  const order = await startCheckoutApi(kind, item, seats);

  if (order.isMock) {
    const agreed = window.confirm(`Development mode: no payment provider is set up.\n\nSimulate paying ${rupees(order.amount)} for "${order.description}"?`);
    if (!agreed) return "cancelled";
    await devPayApi(kind, item, seats);
    return "simulated";
  }

  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: "PactDoc",
      description: order.description,
      prefill: { name: order.customer?.name, email: order.customer?.email },
      handler: () => resolve("paid"),
      modal: { ondismiss: () => resolve("cancelled") },
    }).open();
  });
};
