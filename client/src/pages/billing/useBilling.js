import { useOutletContext } from "react-router-dom";

// The Billing tabs read the account, and what can be done with it, from the layout (./BillingLayout.jsx)
export const useBilling = () => useOutletContext();
