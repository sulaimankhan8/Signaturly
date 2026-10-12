import API from "./axios";

export const fetchUserSubscription = async () => {
  const res = await API.get("/billing/subscription");
  return res.data?.data;
};

// Plans and prices, readable without signing in
export const fetchPlansApi = async () => (await API.get("/public/plans")).data?.data;

// "Contact sales": an enquiry about a plan that is agreed with us, not bought with a button
export const sendSalesEnquiryApi = async (enquiry) => (await API.post("/public/sales-enquiries", enquiry)).data;

/**
 * Starts a purchase. `kind` is "plan", "topup" (extra documents), "wallet" (wallet credit) or
 * "seats" (more seats on a plan sold by the seat, where `item` is how many to add).
 * `seats` is how many seats a per-seat plan is bought with.
 * `renew` is how a plan is paid for: "auto" is a subscription that renews by itself, "once"
 * is one prepaid period. `addOn` is a pack of extra documents bought in the same payment.
 * `quantity` is how many of a pack of extra documents are bought at once.
 * `amountInr` is the amount of wallet credit, when the customer chose their own (`item` is then "custom").
 */
export const startCheckoutApi = async (kind, item, { seats, renew, addOn, quantity, amountInr } = {}) =>
  (await API.post("/billing/checkout", { kind, item, seats, renew, addOn, quantity, amountInr, plan: kind === "plan" ? item : undefined })).data?.data;

// Hands the server what Razorpay's checkout returned, so the payment is confirmed and applied at once
export const confirmCheckoutApi = async (returned) => (await API.post("/billing/checkout/confirm", returned)).data?.data;

// Kept for screens that buy a plan directly
export const initiateCheckout = async (plan) => startCheckoutApi("plan", plan);

export const triggerDevMockUpgrade = async (plan) => {
  const res = await API.post("/billing/dev-upgrade", { plan });
  return res.data?.data;
};

// Whether a payment has reached the account's record yet, and what it bought
export const checkoutStatusApi = async ({ paymentId, subscriptionId }) =>
  (await API.get("/billing/checkout/status", { params: { ...(paymentId ? { paymentId } : {}), ...(subscriptionId ? { subscriptionId } : {}) } })).data?.data;

// Development only: completes a simulated purchase
export const devPayApi = async (kind, item, { seats, renew, addOn, quantity, amountInr } = {}) => (await API.post("/billing/dev-pay", { kind, item, seats, renew, addOn, quantity, amountInr })).data?.data;

// Stops the plan renewing by itself. The time already paid for is kept.
export const stopAutoRenewApi = async () => (await API.post("/billing/auto-renew/stop", {})).data;

// Development only: the next automatic charge of a simulated subscription
export const devRenewApi = async () => (await API.post("/billing/dev-renew", {})).data?.data;

export const openCustomerBillingPortal = async () => {
  const res = await API.post("/billing/portal", {});
  return res.data?.data;
};

export const fetchWalletApi = async () => (await API.get("/billing/wallet")).data?.data;

export const fetchBillingProfileApi = async () => (await API.get("/billing/profile")).data?.data;

export const saveBillingProfileApi = async (profile) => (await API.put("/billing/profile", profile)).data?.data;

export const fetchInvoicesApi = async () => (await API.get("/billing/invoices")).data?.data;

// The invoice PDF. Fetched with the sign-in header, then handed to the browser to save.
export const downloadInvoiceApi = async (id) => (await API.get(`/billing/invoices/${id}/pdf`, { responseType: "blob" })).data;
