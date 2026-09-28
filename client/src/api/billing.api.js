import API from "./axios";

export const fetchUserSubscription = async () => {
  const res = await API.get("/billing/subscription");
  return res.data?.data;
};

export const initiateCheckout = async (plan, gateway = "stripe") => {
  const res = await API.post("/billing/checkout", { plan, gateway });
  return res.data?.data;
};

export const triggerDevMockUpgrade = async (plan) => {
  const res = await API.post("/billing/dev-upgrade", { plan });
  return res.data?.data;
};

export const openCustomerBillingPortal = async () => {
  const res = await API.post("/billing/portal", {});
  return res.data?.data;
};
