import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";
import {
  fetchApiKeysApi,
  createApiKeyApi,
  revokeApiKeyApi,
  fetchWebhooksApi,
  createWebhookApi,
  deleteWebhookApi,
} from "../api/developer.api";
import { fetchUserSubscription } from "../api/billing.api";
import { UpgradeModal } from "../components/UpgradeModal";
import toast, { Toaster } from "react-hot-toast";

export default function ApiSettings() {
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subData, setSubData] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // New API Key form state
  const [keyName, setKeyName] = useState("");
  const [keyExpiresInDays, setKeyExpiresInDays] = useState(90);
  const [keyScopes, setKeyScopes] = useState(["documents:read", "documents:write"]);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);

  // New Webhook form state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState(["document.completed"]);
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    type: "danger",
    onConfirm: null,
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [keys, hooks, sub] = await Promise.all([
        fetchApiKeysApi().catch(() => []),
        fetchWebhooksApi().catch(() => []),
        fetchUserSubscription().catch(() => null),
      ]);
      setApiKeys(keys || []);
      setWebhooks(hooks || []);
      setSubData(sub);
    } catch (err) {
      console.error("Developer data load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isEnterprise = subData?.subscription?.plan === "enterprise";

  const handleGenerateKey = async (e) => {
    e.preventDefault();
    if (!isEnterprise) {
      setUpgradeModalOpen(true);
      return;
    }
    if (!keyName.trim()) return;

    try {
      setIsGeneratingKey(true);
      const created = await createApiKeyApi({
        name: keyName,
        scopes: keyScopes,
        expiresInDays: parseInt(keyExpiresInDays, 10),
      });
      const keyString = created?.secretKey || created?.apiKey || created?.fullKey || (typeof created === "string" ? created : "");
      setNewlyCreatedKey(keyString);
      toast.success("REST API Key generated! Copy it now as it won't be displayed again.");
      setKeyName("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate API Key");
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeKey = (keyId, name) => {
    setConfirmModal({
      isOpen: true,
      title: "Revoke API Key",
      message: `Are you sure you want to revoke API Key "${name}"? Any active integrations using it will fail immediately.`,
      confirmText: "Revoke Key",
      type: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await revokeApiKeyApi(keyId);
          toast.success("API Key revoked successfully");
          loadData();
        } catch (err) {
          toast.error(err.response?.data?.message || "Failed to revoke key");
        }
      },
    });
  };

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!isEnterprise) {
      setUpgradeModalOpen(true);
      return;
    }
    if (!webhookUrl.trim()) return;

    try {
      setIsCreatingWebhook(true);
      await createWebhookApi({
        url: webhookUrl,
        events: webhookEvents,
      });
      toast.success("Webhook endpoint registered successfully!");
      setWebhookUrl("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create webhook");
    } finally {
      setIsCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = (webhookId) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Webhook Subscription",
      message: "Are you sure you want to remove this webhook endpoint? You will stop receiving event notifications.",
      confirmText: "Delete Webhook",
      type: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteWebhookApi(webhookId);
          toast.success("Webhook deleted");
          loadData();
        } catch (err) {
          toast.error(err.response?.data?.message || "Failed to delete webhook");
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col font-sans">
      <Navbar />
      <Toaster position="top-right" />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                Developer REST API &amp; Webhooks
              </h1>
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                Enterprise
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Programmatically create signing envelopes, embed signers, and listen to real-time HMAC signed webhook events.
            </p>
          </div>
        </div>

        {/* LOCKED SCREEN: Rendered when user is NOT on Enterprise Tier and has NO existing keys/webhooks */}
        {!isEnterprise && apiKeys.length === 0 && webhooks.length === 0 ? (
          <div className="bg-[#12141c] border-2 border-amber-500/40 rounded-2xl p-5 sm:p-6 text-center space-y-4 shadow-xl relative overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40 shadow-inner">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>

            <div className="max-w-xl mx-auto space-y-1.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-800">
                Enterprise Developer Access
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Unlock Developer REST APIs &amp; Webhooks
              </h2>
              <p className="text-xs text-gray-300 leading-relaxed">
                Your current plan (<strong className="text-yellow-400 font-mono uppercase">{subData?.subscription?.plan || "Free Starter"}</strong>) does not have Developer API permissions. Upgrade to Enterprise to generate HMAC API keys and listen to webhook events.
              </p>
            </div>

            {/* Developer Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left max-w-3xl mx-auto">
              <div className="bg-[#08090d] p-3.5 rounded-xl border border-white/10 space-y-1">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-bold text-white text-[11px] uppercase text-amber-400">Scoped REST API Keys</h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Generate secure <code className="text-amber-300">sig_live_...</code> bearer tokens with granular permissions.
                </p>
              </div>

              <div className="bg-[#08090d] p-3.5 rounded-xl border border-white/10 space-y-1">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-bold text-white text-[11px] uppercase text-blue-400">Real-Time Webhooks</h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Receive instant payload updates on <code className="text-gray-300">envelope.completed</code> and signature events.
                </p>
              </div>

              <div className="bg-[#08090d] p-3.5 rounded-xl border border-white/10 space-y-1">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="font-bold text-white text-[11px] uppercase text-emerald-400">Section 63 Proof API</h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Programmatically verify SHA-256 certificate proofs for court admissibility.
                </p>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(true)}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-950/60 transition-all cursor-pointer transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Upgrade to Enterprise ($14.99/seat) →</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="w-full sm:w-auto px-5 py-2.5 bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* DEVELOPER INTERFACE */
          <div className="space-y-8">
            {/* Read-Only Warning Banner if Downgraded */}
            {!isEnterprise && (
              <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">Developer Access is in Read-Only Mode</h4>
                    <p className="text-[11px] text-gray-300">
                      Your current plan does not include active API execution. Existing keys &amp; webhooks are paused. You may revoke or clean up items below, or upgrade to re-activate.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shrink-0 cursor-pointer"
                >
                  Upgrade to Enterprise
                </button>
              </div>
            )}

            {/* Newly Created Key Alert Modal */}
            {newlyCreatedKey && (
              <div className="bg-emerald-950/70 border-2 border-emerald-500/60 rounded-3xl p-6 space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span>Secret API Key Created Successfully</span>
                  </div>
                  <button
                    onClick={() => setNewlyCreatedKey(null)}
                    className="text-gray-400 hover:text-white text-xs cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>
                <p className="text-xs text-emerald-200">
                  Please copy your API key now and store it in a secure location. You will not be able to view it again.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newlyCreatedKey}
                    className="flex-1 bg-black/60 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-xs text-emerald-300 font-mono select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newlyCreatedKey);
                      toast.success("API key copied to clipboard!");
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                  >
                    Copy Key
                  </button>
                </div>
              </div>
            )}

            {/* API Keys Section */}
            <div className="bg-[#12141c] rounded-3xl p-6 sm:p-8 border-2 border-white/10 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-white">Active REST API Keys</h2>
                  <p className="text-xs text-gray-400">
                    Use these bearer tokens to authenticate with <code className="text-amber-400">https://api.signaturly.pro/api</code>
                  </p>
                </div>
              </div>

              {/* Generate New Key Form (Gated if not enterprise) */}
              {isEnterprise ? (
                <form onSubmit={handleGenerateKey} className="bg-[#08090d] p-5 rounded-2xl border border-white/10 space-y-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Generate New API Key
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Key Name / Integration Identifier
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Zapier Production, Backend CRM Integration"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        className="w-full bg-[#12141c] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Expiration Period
                      </label>
                      <select
                        value={keyExpiresInDays}
                        onChange={(e) => setKeyExpiresInDays(e.target.value)}
                        className="w-full bg-[#12141c] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        <option value={30}>30 Days</option>
                        <option value={90}>90 Days (Recommended)</option>
                        <option value={180}>180 Days</option>
                        <option value={365}>1 Year</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={keyScopes.includes("documents:read")}
                          onChange={(e) => {
                            setKeyScopes(e.target.checked
                              ? [...keyScopes, "documents:read"]
                              : keyScopes.filter((s) => s !== "documents:read")
                            );
                          }}
                          className="rounded accent-amber-400"
                        />
                        <span>documents:read</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={keyScopes.includes("documents:write")}
                          onChange={(e) => {
                            setKeyScopes(e.target.checked
                              ? [...keyScopes, "documents:write"]
                              : keyScopes.filter((s) => s !== "documents:write")
                            );
                          }}
                          className="rounded accent-amber-400"
                        />
                        <span>documents:write</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isGeneratingKey}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer"
                    >
                      {isGeneratingKey ? "Generating..." : "Generate Live Key →"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-[#08090d] p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Upgrade to Enterprise to create new API keys.</p>
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="px-4 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl hover:bg-amber-500/30 transition-all cursor-pointer"
                  >
                    + Generate New Key
                  </button>
                </div>
              )}

              {/* Keys List */}
              <div className="space-y-2">
                {apiKeys.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-xs">
                    No active API keys found.
                  </div>
                ) : (
                  apiKeys.map((key) => (
                    <div
                      key={key._id}
                      className="bg-[#08090d] p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{key.name}</span>
                          <span className="font-mono text-[10px] text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                            {key.keyPrefix}••••••••
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          Scopes: {key.permissions?.join(", ") || "documents:read, documents:write"} &bull; Created: {new Date(key.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeKey(key._id, key.name)}
                        className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-700/40 text-xs font-bold rounded-xl transition-all self-start sm:self-auto cursor-pointer"
                      >
                        Revoke Key
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Webhooks Section */}
            <div className="bg-[#12141c] rounded-3xl p-6 sm:p-8 border-2 border-white/10 space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Outbound Webhook Subscriptions</h2>
                <p className="text-xs text-gray-400">
                  Receive real-time HTTP POST notifications when contracts are viewed, signed, or executed.
                </p>
              </div>

              {/* Create Webhook Form (Gated if not enterprise) */}
              {isEnterprise ? (
                <form onSubmit={handleCreateWebhook} className="bg-[#08090d] p-5 rounded-2xl border border-white/10 space-y-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Subscribe New Webhook Endpoint
                  </h3>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      required
                      placeholder="https://yourserver.com/webhooks/signaturly"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="flex-1 bg-[#12141c] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={isCreatingWebhook}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer whitespace-nowrap"
                    >
                      {isCreatingWebhook ? "Registering..." : "+ Register Webhook"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-[#08090d] p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Upgrade to Enterprise to subscribe new webhook endpoints.</p>
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="px-4 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl hover:bg-amber-500/30 transition-all cursor-pointer"
                  >
                    + Register Webhook
                  </button>
                </div>
              )}

              {/* Webhooks List */}
              <div className="space-y-2">
                {webhooks.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-xs">
                    No webhooks registered yet.
                  </div>
                ) : (
                  webhooks.map((hook) => (
                    <div
                      key={hook._id}
                      className="bg-[#08090d] p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="font-mono text-xs text-white truncate max-w-md">{hook.url}</div>
                        <div className="text-[10px] text-gray-400">
                          Events: {hook.events?.join(", ") || "envelope.completed"} &bull; Created: {new Date(hook.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteWebhook(hook._id)}
                        className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-700/40 text-xs font-bold rounded-xl transition-all self-start sm:self-auto cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        requiredPlan="enterprise"
      />
    </div>
  );
}
