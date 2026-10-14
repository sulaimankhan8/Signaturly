import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { fetchUserSubscription, fetchWalletApi, fetchInvoicesApi, fetchBillingProfileApi } from "../api/billing.api";
import { PAYMENT_SHOWN } from "../utils/checkout";
import { NO_PROFILE } from "../utils/billing";

/**
 * The account's subscription, read once and shared by everything that shows it outside the
 * billing pages (the button and the alert under the navbar). Read again after a minute, after
 * a payment, or when a billing page has read it anyway.
 */
const FRESH_MS = 60 * 1000;
const shared = { data: null, at: 0, loading: null };
const listeners = new Set();
const tell = () => listeners.forEach((listener) => listener(shared.data));

export const primeSubscription = (data) => {
  shared.data = data;
  shared.at = Date.now();
  tell();
};

const loadShared = (force = false) => {
  if (!force && shared.data && Date.now() - shared.at < FRESH_MS) return Promise.resolve(shared.data);
  if (!shared.loading) {
    shared.loading = fetchUserSubscription()
      .then((data) => {
        primeSubscription(data);
        return data;
      })
      .catch(() => shared.data)
      .finally(() => {
        shared.loading = null;
      });
  }
  return shared.loading;
};

if (typeof window !== "undefined") {
  // A payment has just been confirmed: what the account has may have changed
  window.addEventListener(PAYMENT_SHOWN, () => {
    shared.at = 0;
  });
}

export const useSubscription = () => {
  const user = useSelector((state) => state.auth.user);
  const [data, setData] = useState(shared.data);

  useEffect(() => {
    if (!user) {
      // Whoever signs in next has their own account read afresh
      shared.data = null;
      shared.at = 0;
      return undefined;
    }
    listeners.add(setData);
    loadShared();
    return () => listeners.delete(setData);
  }, [user]);

  // Signed out, nothing of an account is shown, whatever was read before
  return user ? data : null;
};

/**
 * Everything the billing pages show about an account: its subscription and usage, wallet,
 * invoices and the details printed on them. Read once the person is signed in.
 */
export default function useBillingAccount({ invoices: withInvoices = true, wallet: withWallet = true } = {}) {
  const user = useSelector((state) => state.auth.user);
  const [account, setAccount] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [profile, setProfile] = useState(NO_PROFILE);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    const [subscription, walletData, invoiceList, billingProfile] = await Promise.all([
      fetchUserSubscription(),
      withWallet ? fetchWalletApi() : null,
      withInvoices ? fetchInvoicesApi() : [],
      fetchBillingProfileApi(),
    ]);
    setAccount(subscription);
    primeSubscription(subscription);
    setWallet(walletData);
    setInvoices(invoiceList || []);
    setProfile({ ...NO_PROFILE, ...billingProfile });
    setFailed(false);
  }, [withInvoices, withWallet]);

  const load = useCallback(() => reload().catch(() => setFailed(true)), [reload]);

  // Read once someone is signed in; every state change happens after the requests answer
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [user, load]);

  return { user, account, wallet, invoices, profile, setProfile, failed, loading: Boolean(user) && !account && !failed, reload, load };
}
