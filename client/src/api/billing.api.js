import API from "./axios";

export const fetchUserSubscription = async () => {
  const res = await API.get("/billing/subscription");
  return res.data?.data;
};

// Plans and prices, readable without signing in
export const fetchPlansApi = async () => (await API.get("/public/plans")).data?.data;

/**
 * Starts a purchase. `kind` is "plan", "topup" (extra documents), "wallet" (wallet credit) or
 * "seats" (more seats on a plan sold by the seat, where `item` is how many to add).
 * `seats` is how many seats a per-seat plan is bought with.
 */
export const startCheckoutApi = async (kind, item, seats) =>
  (await API.post("/billing/checkout", { kind, item, seats, plan: kind === "plan" ? item : undefined })).data?.data;

// Kept for screens that buy a plan directly
export const initiateCheckout = async (plan) => startCheckoutApi("plan", plan);

export const triggerDevMockUpgrade = async (plan) => {
  const res = await API.post("/billing/dev-upgrade", { plan });
  return res.data?.data;
};

// Development only: completes a simulated purchase
export const devPayApi = async (kind, item, seats) => (await API.post("/billing/dev-pay", { kind, item, seats })).data?.data;

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
