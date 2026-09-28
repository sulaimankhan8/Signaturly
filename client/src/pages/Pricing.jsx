import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Navbar from "../components/Navbar";
import { fetchUserSubscription, initiateCheckout, triggerDevMockUpgrade } from "../api/billing.api";
import toast, { Toaster } from "react-hot-toast";

export default function Pricing() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = !!user;

  const [billingCycle, setBillingCycle] = useState("monthly"); // 'monthly' | 'annual'
  const [subData, setSubData] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [devSimulationModal, setDevSimulationModal] = useState(null);

  const loadSub = () => {
    if (isAuthenticated) {
      fetchUserSubscription()
        .then((data) => setSubData(data))
        .catch(() => {});
    }
  };

  useEffect(() => {
    loadSub();
  }, [isAuthenticated]);

  const handleDirectPlanCheckout = async (planKey) => {
    if (!isAuthenticated) {
      navigate("/register");
      return;
    }

    try {
      setLoadingPlan(planKey);
      const res = await initiateCheckout(planKey);

      if (res?.isMock) {
        // Zero-credential simulation mode: Show direct 1-click confirmation for THIS specific plan
        setDevSimulationModal(res);
      } else if (res?.checkoutUrl) {
        // Direct redirect to live Stripe checkout for this plan
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      console.error("Direct checkout error:", err);
      toast.error(err.response?.data?.message || "Failed to initialize checkout session");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleConfirmDevUpgrade = async (plan) => {
    try {
      setLoadingPlan(plan);
      await triggerDevMockUpgrade(plan);
      toast.success(`Account upgraded to ${plan.toUpperCase()} successfully!`);
      setDevSimulationModal(null);
      loadSub();
    } catch (err) {
      toast.error("Dev upgrade failed: " + err.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const currentPlan = subData?.subscription?.plan || "free";

  return (
    <div className="min-h-screen bg-[#08090d] text-white selection:bg-red-600 selection:text-white flex flex-col font-sans">
      <Toaster position="top-right" />
      {isAuthenticated && <Navbar />}

      {/* Dev Simulation Direct Confirmation Modal (Single Plan, Zero Redundancy) */}
      {devSimulationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#12141c] border-2 border-purple-500/50 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center mx-auto border border-purple-500/40">
              <svg className="w-7 h-7 text-purple-400 fill-current" viewBox="0 0 20 20">
                <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-950 text-purple-300 px-3 py-1 rounded-full border border-purple-800">
                Zero-Credential Simulation Mode
              </span>
              <h3 className="text-xl font-black text-white mt-3">
                Activate {devSimulationModal.planName}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                No Stripe secret key detected in backend <code>.env</code>. Click below to simulate an instant 1-click upgrade.
              </p>
            </div>

            <div className="bg-[#08090d] p-4 rounded-2xl border border-white/10 text-left text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Selected Tier:</span>
                <span className="font-bold text-white uppercase">{devSimulationModal.plan}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-400">Total Price:</span>
                <span className="font-black text-emerald-400 font-mono text-sm">${devSimulationModal.amount} USD</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDevSimulationModal(null)}
                className="flex-1 py-3 rounded-xl border border-white/20 text-xs font-bold text-gray-300 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loadingPlan !== null}
                onClick={() => handleConfirmDevUpgrade(devSimulationModal.plan)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
              >
                {loadingPlan ? "Activating..." : "Confirm & Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header / Hero */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          {!isAuthenticated && (
            <div
              onClick={() => navigate("/landing")}
              className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-white cursor-pointer mb-1"
            >
              <span>← Back to Home</span>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-400/10 text-yellow-400 border border-yellow-400/30">
              Simple, Transparent Pricing
            </span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Choose the Perfect Plan for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-yellow-400">
              Your E-Signatures
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-lg mx-auto">
            Legally binding contracts, SHA-256 cryptographic seals, and zero hidden per-doc fees.
          </p>

          {/* Monthly / Annual Toggle (Compact) */}
          <div className="pt-2 flex justify-center">
            <div className="bg-[#12141c] p-0.5 rounded-xl border border-white/15 shadow-md inline-flex items-center">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  billingCycle === "monthly"
                    ? "bg-red-600 text-white shadow-sm font-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  billingCycle === "annual"
                    ? "bg-red-600 text-white shadow-sm font-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>Annual</span>
                <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-0.2 rounded font-black border border-black">
                  SAVE 32%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 4-Column Pricing Grid (Optimized & Compact) */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-stretch">
          {/* Card 1: Free Starter */}
          <div className="bg-[#12141c] rounded-2xl p-5 border-2 border-white/10 flex flex-col justify-between hover:border-white/25 transition-all shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  Free Forever
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-2">Free Starter</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">$0</span>
                <span className="text-xs text-gray-400">/ forever</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 min-h-[30px] leading-tight">
                Ideal for individuals getting started with occasional signature requests.
              </p>

              <div className="border-t border-white/10 my-3.5" />

              <ul className="space-y-1.5 text-[11px] text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>15 Envelopes</strong> / month</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>2FA Email OTP Verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Draw, Type &amp; Upload</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>SHA-256 Audit Trail</span>
                </li>
                <li className="flex items-center gap-2 text-gray-400">
                  <span className="text-gray-400">•</span>
                  <span>Ad-supported signing page</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 pt-1">
              {currentPlan === "free" && isAuthenticated ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-white/10 text-gray-400 font-bold text-xs border border-white/10 cursor-default"
                >
                  Current Active Plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => (!isAuthenticated ? navigate("/register") : navigate("/dashboard"))}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer"
                >
                  {isAuthenticated ? "Use Free Plan" : "Start Free"}
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Pro Creator */}
          <div className="bg-[#151724] rounded-2xl p-5 border-2 border-yellow-400 flex flex-col justify-between relative shadow-[4px_4px_0px_0px_#ef4444] lg:-translate-y-1">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-yellow-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border border-black shadow">
              Most Popular
            </span>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/30">
                  Individual Pro
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-2">Pro Creator</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">
                  ${billingCycle === "monthly" ? "5.99" : "4.08"}
                </span>
                <span className="text-xs text-gray-400">/ month</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 min-h-[30px] leading-tight">
                {billingCycle === "annual" ? "$49 billed annually" : "Billed monthly • Cancel anytime"}
              </p>

              <div className="border-t border-white/10 my-3.5" />

              <ul className="space-y-1.5 text-[11px] text-gray-200">
                <li className="flex items-center gap-2">
                  <span className="text-yellow-400 font-bold">✓</span>
                  <span><strong className="text-yellow-300">Unlimited</strong> envelopes</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-yellow-400 font-bold">✓</span>
                  <span><strong>100% Ad-Free</strong> for signers</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-yellow-400 font-bold">✓</span>
                  <span>14 Prebuilt legal templates</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-yellow-400 font-bold">✓</span>
                  <span>CSV Bulk Send (150/batch)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-yellow-400 font-bold">✓</span>
                  <span>Custom email reminders</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 pt-1">
              {currentPlan === "pro_monthly" || currentPlan === "pro_annual" ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-yellow-400/20 text-yellow-300 font-bold text-xs border border-yellow-400/40 cursor-default"
                >
                  Current Active Plan
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loadingPlan !== null}
                  onClick={() => handleDirectPlanCheckout(billingCycle === "monthly" ? "pro_monthly" : "pro_annual")}
                  className="w-full py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer"
                >
                  {loadingPlan === "pro_monthly" || loadingPlan === "pro_annual" ? "Processing..." : "Upgrade to Pro →"}
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Lifetime Pass */}
          <div className="bg-gradient-to-b from-[#181226] via-[#12141c] to-[#12141c] rounded-2xl p-5 border-2 border-purple-500/50 flex flex-col justify-between relative shadow-lg hover:border-purple-400 transition-all">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border border-black shadow">
              Founder Deal
            </span>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase font-bold text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-700/50">
                  Zero Subscriptions
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-2">Lifetime Pass</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">$69</span>
                <span className="text-xs text-purple-400">one-time</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 min-h-[30px] leading-tight">
                Pay once and get lifetime unlimited signatures forever.
              </p>

              <div className="border-t border-white/10 my-3.5" />

              <ul className="space-y-1.5 text-[11px] text-gray-200">
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span><strong>Unlimited signatures</strong> forever</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span>All Pro Creator features</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span>All future updates included</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span>Single user lifetime license</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span>Zero monthly or annual fees</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 pt-1">
              {currentPlan === "lifetime" ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-purple-900/40 text-purple-300 font-bold text-xs border border-purple-700/50 cursor-default flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 text-purple-300 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>Lifetime Pass Active</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loadingPlan !== null}
                  onClick={() => handleDirectPlanCheckout("lifetime")}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer"
                >
                  {loadingPlan === "lifetime" ? "Processing..." : "Claim Lifetime ($69) →"}
                </button>
              )}
            </div>
          </div>

          {/* Card 4: Enterprise */}
          <div className="bg-[#12141c] rounded-2xl p-5 border-2 border-white/10 flex flex-col justify-between hover:border-white/25 transition-all shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-700/40">
                  Organizations
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-2">Enterprise</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">
                  ${billingCycle === "monthly" ? "14.99" : "10.75"}
                </span>
                <span className="text-xs text-gray-400">/ seat / mo</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 min-h-[30px] leading-tight">
                For teams requiring multi-tenancy, custom branding &amp; APIs.
              </p>

              <div className="border-t border-white/10 my-3.5" />

              <ul className="space-y-1.5 text-[11px] text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">✓</span>
                  <span><strong>Multi-Tenant Workspaces</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">✓</span>
                  <span><strong>Custom Brand White-Label</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">✓</span>
                  <span><strong>Developer REST APIs</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">✓</span>
                  <span><strong>Webhook Event Streams</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">✓</span>
                  <span>Dedicated compliance SLA</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 pt-1">
              {currentPlan === "enterprise" ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-blue-900/30 text-blue-300 font-bold text-xs border border-blue-700/40 cursor-default"
                >
                  Enterprise Active
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loadingPlan !== null}
                  onClick={() => handleDirectPlanCheckout("enterprise")}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-blue-600 hover:text-white text-gray-200 font-bold text-xs border border-white/20 transition-all cursor-pointer"
                >
                  {loadingPlan === "enterprise" ? "Processing..." : "Get Enterprise →"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Feature Comparison Matrix (Compact) */}
        <div className="mt-12 bg-[#12141c] rounded-2xl p-5 sm:p-8 border-2 border-white/10">
          <div className="text-center max-w-xl mx-auto mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white">Full Feature Comparison</h2>
            <p className="text-xs text-gray-400 mt-1">
              Side-by-side entitlement matrix across all available tiers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-white/10 text-gray-400">
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider">Features</th>
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider text-center">Free Starter</th>
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider text-center text-yellow-400">Pro Creator</th>
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider text-center text-purple-400">Lifetime Pass</th>
                  <th className="py-2.5 px-3 font-black uppercase tracking-wider text-center text-blue-400">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Monthly Signature Quota</td>
                  <td className="py-2.5 px-3 text-center">15 / month</td>
                  <td className="py-2.5 px-3 text-center font-bold text-yellow-400">Unlimited</td>
                  <td className="py-2.5 px-3 text-center font-bold text-purple-400">Unlimited Forever</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-400">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Ad-Free Signing Experience</td>
                  <td className="py-2.5 px-3 text-center text-gray-500">Sponsored Ads</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">100% Ad-Free</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">100% Ad-Free</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">100% Ad-Free</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Cryptographic SHA-256 Audit Trail</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">CSV Bulk Mail Merge (150/batch)</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Reusable Legal Templates</td>
                  <td className="py-2.5 px-3 text-center text-gray-500">Basic</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">14 Master Templates</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">14 Master Templates</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Unlimited Custom</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Multi-Tenant Workspaces &amp; RBAC</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Custom Brand Logo &amp; White-Label</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Developer REST API &amp; Webhooks</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">—</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ Included</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
