import React, { useState } from "react";
import { initiateCheckout, triggerDevMockUpgrade } from "../api/billing.api";
import toast from "react-hot-toast";

export const UpgradeModal = ({ isOpen, onClose, onUpgraded, reason }) => {
  const [billingCycle, setBillingCycle] = useState("monthly"); // 'monthly' | 'annual'
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [devSimulationModal, setDevSimulationModal] = useState(null);

  if (!isOpen) return null;

  const handleSelectPlan = async (planKey) => {
    try {
      setLoadingPlan(planKey);
      const res = await initiateCheckout(planKey);

      if (res?.isMock) {
        // Zero-credential simulation mode
        setDevSimulationModal(res);
      } else if (res?.checkoutUrl) {
        // Live Stripe redirect
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      console.error("Checkout initiation error:", err);
      toast.error(err.response?.data?.message || "Failed to initialize checkout session");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleConfirmDevUpgrade = async (plan) => {
    try {
      setLoadingPlan(plan);
      await triggerDevMockUpgrade(plan);
      toast.success(`Dev Mode: Account upgraded to ${plan.toUpperCase()} successfully!`);
      setDevSimulationModal(null);
      if (onUpgraded) onUpgraded();
      if (onClose) onClose();
    } catch (err) {
      toast.error("Dev upgrade failed: " + err.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Dev Simulation Modal */}
      {devSimulationModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/90">
          <div className="bg-neutral-900 border border-purple-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl text-center flex flex-col gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/40">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase bg-purple-950 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-800">
                Zero-Credential Dev Mode
              </span>
              <h3 className="text-lg font-bold text-white mt-2">
                Simulate {devSimulationModal.planName}
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                No Stripe API key detected in .env. Click below to simulate an instant 1-click upgrade.
              </p>
            </div>
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 text-left text-xs text-neutral-300">
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">Selected Plan:</span>
                <span className="font-semibold text-white">{devSimulationModal.plan}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Amount:</span>
                <span className="font-semibold text-emerald-400">${devSimulationModal.amount} USD</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDevSimulationModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDevUpgrade(devSimulationModal.plan)}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-600/30"
              >
                Confirm Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Upgrade Modal */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white text-xl p-2 cursor-pointer"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center max-w-xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 text-purple-300">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Upgrade to Signaturly Pro</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
            Unlock Unlimited E-Signatures &amp; Power Tools
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2">
            {reason || "You have reached the 15 documents/month limit on the Free Starter plan. Choose a plan below to keep sending."}
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 mt-5">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                billingCycle === "monthly"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                billingCycle === "annual"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>Annual Billing</span>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.2 rounded font-bold border border-emerald-500/40">
                Save 32%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Pro Plan */}
          <div className="bg-neutral-950 border-2 border-purple-500/50 rounded-2xl p-6 flex flex-col justify-between relative shadow-xl shadow-purple-950/20">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-md">
              Most Popular
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Pro Creator</h3>
              <p className="text-xs text-neutral-400 mt-1">For freelancers &amp; professionals</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">
                  ${billingCycle === "monthly" ? "5.99" : "4.08"}
                </span>
                <span className="text-xs text-neutral-400">/ month</span>
              </div>
              {billingCycle === "annual" && (
                <p className="text-[11px] text-emerald-400 mt-0.5">$49 billed annually</p>
              )}
              <ul className="mt-5 space-y-2 text-xs text-neutral-300">
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><span className="font-semibold text-white">Unlimited</span> envelopes</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>100% Ad-Free for signers</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>14 Reusable legal templates</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>CSV Bulk Mail Merge</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Cryptographic SHA-256 seal</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              disabled={loadingPlan !== null}
              onClick={() => handleSelectPlan(billingCycle === "monthly" ? "pro_monthly" : "pro_annual")}
              className="mt-6 w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              {loadingPlan === "pro_monthly" || loadingPlan === "pro_annual" ? "Processing..." : "Select Pro Plan"}
            </button>
          </div>

          {/* 2. Lifetime Pass (LTD) */}
          <div className="bg-gradient-to-b from-neutral-950 via-purple-950/20 to-neutral-950 border border-purple-500/30 rounded-2xl p-6 flex flex-col justify-between relative shadow-lg">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-800 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
              Founder Deal
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Lifetime Pass (LTD)</h3>
              <p className="text-xs text-neutral-400 mt-1">Pay once, use forever</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">$69</span>
                <span className="text-xs text-neutral-400">one-time</span>
              </div>
              <p className="text-[11px] text-purple-400 mt-0.5">Zero recurring subscriptions</p>
              <ul className="mt-5 space-y-2 text-xs text-neutral-300">
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><span className="font-semibold text-white">Lifetime unlimited</span> access</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>100% Ad-Free forever</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>All future Pro updates included</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Single-user lifetime license</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Priority founder support</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              disabled={loadingPlan !== null}
              onClick={() => handleSelectPlan("lifetime")}
              className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              {loadingPlan === "lifetime" ? "Processing..." : "Claim Lifetime Pass ($69)"}
            </button>
          </div>

          {/* 3. Business & Enterprise */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between relative shadow-lg">
            <div>
              <h3 className="text-base font-bold text-white">Enterprise</h3>
              <p className="text-xs text-neutral-400 mt-1">For growing teams &amp; agencies</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">
                  ${billingCycle === "monthly" ? "14.99" : "10.75"}
                </span>
                <span className="text-xs text-neutral-400">/ user / mo</span>
              </div>
              <ul className="mt-5 space-y-2 text-xs text-neutral-300">
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Multi-User Team Workspaces</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Custom Brand White-Labeling</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Developer REST API &amp; Webhooks</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Dedicated Account Manager</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              disabled={loadingPlan !== null}
              onClick={() => handleSelectPlan("enterprise")}
              className="mt-6 w-full py-2.5 rounded-xl border border-neutral-700 hover:border-neutral-500 text-white text-xs font-bold transition-all cursor-pointer"
            >
              {loadingPlan === "enterprise" ? "Processing..." : "Select Enterprise"}
            </button>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="border-t border-neutral-800/80 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>256-bit SSL Encrypted Checkout via Stripe</span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Instant Activation • Cancel Anytime</span>
          </span>
        </div>
      </div>
    </div>
  );
};
