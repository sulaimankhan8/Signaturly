import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";
import {
  fetchApiKeysApi,
  createApiKeyApi,
  revokeApiKeyApi,
  fetchWebhooksApi,
  createWebhookApi,
  deleteWebhookApi,
  fetchWebhookDeliveriesApi,
  replayWebhookDeliveryApi,
} from "../api/developer.api";
import { fetchUserSubscription } from "../api/billing.api";

/**
 * Developer settings (plan tasks P6-09, P6-11, P6-13): API keys and webhooks for the
 * workspace the person is working in.
 *
 * A key is shown once, when it is made. A test key makes watermarked documents that are never
 * counted or emailed, so an integration can be tried without sending anything real.
 */

const card = "bg-[#12141c] border border-white/10 rounded-2xl p-6";
const inputClass = "w-full px-3 py-2.5 bg-[#08090d] border border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500";
const primary = "px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold";
const quiet = "px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl text-xs font-bold text-gray-200";
const messageOf = (err, fallback) => (err.response?.data?.message || fallback).replace(/^[A-Z_]+:\s*/, "");
const when = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "never");

const SCOPES = [
  ["documents:read", "Read documents and their status"],
  ["documents:write", "Upload, send, void and remind"],
  ["templates:read", "List saved templates"],
  ["webhooks:manage", "Create and remove webhooks"],
];

const EVENTS = [
  ["envelope.sent", "A document was sent"],
  ["recipient.viewed", "A signer opened it"],
  ["recipient.signed", "A signer signed"],
  ["envelope.completed", "Everyone has signed"],
  ["envelope.declined", "A signer declined"],
  ["envelope.voided", "The sender voided it"],
];

const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

export default function ApiSettings() {
  const [keys, setKeys] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState("");
  const [keyForm, setKeyForm] = useState({ name: "", mode: "test", permissions: ["documents:read", "documents:write"] });
  const [hookForm, setHookForm] = useState({ url: "", events: ["envelope.completed", "recipient.signed"] });
  // Shown once after creating: the key itself, or a webhook's signing secret
  const [reveal, setReveal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [deliveries, setDeliveries] = useState({});

  const hasApi = Boolean(subscription?.entitlements?.features?.api);

  const load = useCallback(async () => {
    setSubscription(await fetchUserSubscription().catch(() => null));
    try {
      const [foundKeys, foundHooks] = await Promise.all([fetchApiKeysApi(), fetchWebhooksApi()]);
      setKeys(foundKeys || []);
      setWebhooks(foundHooks || []);
      setProblem("");
    } catch (err) {
      setKeys([]);
      setProblem(messageOf(err, "Developer settings could not be loaded"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createKey = async (event) => {
    event.preventDefault();
    setBusy("key");
    try {
      const created = await createApiKeyApi(keyForm);
      setReveal({ title: `Your new ${created.mode} key`, value: created.secretKey, note: "Copy it now. It is not shown again; if you lose it, revoke it and make another." });
      setKeyForm({ ...keyForm, name: "" });
      await load();
    } catch (err) {
      toast.error(messageOf(err, "The key could not be created"));
    } finally {
      setBusy("");
    }
  };

  const createHook = async (event) => {
    event.preventDefault();
    setBusy("hook");
    try {
      const created = await createWebhookApi(hookForm);
      setReveal({ title: "Webhook signing secret", value: created.secret, note: "Use it to check that requests really come from PactDoc. It is not shown again." });
      setHookForm({ ...hookForm, url: "" });
      await load();
    } catch (err) {
      toast.error(messageOf(err, "The webhook could not be created"));
    } finally {
      setBusy("");
    }
  };

  const showDeliveries = async (webhookId) => {
    if (deliveries[webhookId]) return setDeliveries({ ...deliveries, [webhookId]: null });
    try {
      setDeliveries({ ...deliveries, [webhookId]: await fetchWebhookDeliveriesApi(webhookId) });
    } catch (err) {
      toast.error(messageOf(err, "The deliveries could not be loaded"));
    }
  };

  const replay = async (webhookId, deliveryId) => {
    try {
      await replayWebhookDeliveryApi(deliveryId);
      toast.success("Queued to be sent again");
      setDeliveries({ ...deliveries, [webhookId]: await fetchWebhookDeliveriesApi(webhookId) });
    } catch (err) {
      toast.error(messageOf(err, "It could not be sent again"));
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-black text-white">Developer settings</h1>
          <p className="text-sm text-gray-400 mt-1">
            Send documents for signature from your own software, and be told when they are signed. Keys and webhooks belong to the workspace you are working in.
          </p>
        </header>

        {subscription && !hasApi && (
          <div className={`${card} border-amber-500/30`} data-testid="api-upgrade">
            <p className="text-sm text-amber-200 font-bold">The API is not part of your current plan.</p>
            <p className="text-xs text-gray-400 mt-1">Keys you already have can still be seen and revoked here. New keys and webhooks need a plan that includes the API.</p>
            <Link to="/pricing" className={`${primary} inline-block mt-3`}>
              See plans
            </Link>
          </div>
        )}

        {problem && <div className={`${card} text-sm text-amber-200`}>{problem}</div>}

        {reveal && (
          <div className={`${card} border-emerald-500/40`} data-testid="secret-reveal">
            <p className="text-sm font-bold text-white">{reveal.title}</p>
            <code className="block mt-2 px-3 py-2 bg-black/50 rounded-xl text-sm text-emerald-300 break-all">{reveal.value}</code>
            <p className="text-xs text-gray-400 mt-2">{reveal.note}</p>
            <div className="mt-3 flex gap-2">
              <button className={primary} onClick={() => navigator.clipboard?.writeText(reveal.value).then(() => toast.success("Copied"))}>
                Copy
              </button>
              <button className={quiet} onClick={() => setReveal(null)}>
                I have saved it
              </button>
            </div>
          </div>
        )}

        {/* API keys */}
        <section className={card} data-testid="api-keys">
          <h2 className="text-sm font-bold text-white">API keys</h2>
          {keys === null ? (
            <p className="text-sm text-gray-400 mt-3">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="text-xs text-gray-400 mt-2">No keys yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {keys.map((key) => (
                <li key={key.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {key.name}{" "}
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${key.mode === "test" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>{key.mode}</span>
                    </p>
                    <p className="text-xs text-gray-400 font-mono">{key.keyPrefix}…</p>
                    <p className="text-[11px] text-gray-500">
                      {(key.permissions || []).join(", ")} · last used {when(key.lastUsedAt)}
                    </p>
                  </div>
                  <button
                    className={quiet}
                    onClick={() =>
                      setConfirm({
                        title: "Revoke this key?",
                        message: `Anything still using "${key.name}" will stop working at once. This cannot be undone.`,
                        confirmText: "Revoke",
                        run: () => revokeApiKeyApi(key.id),
                      })
                    }
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={createKey} className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
              <input className={inputClass} required maxLength={80} placeholder="What the key is for, for example Billing system" value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} />
              <select className={inputClass} value={keyForm.mode} onChange={(e) => setKeyForm({ ...keyForm, mode: e.target.value })}>
                <option value="test">Test key</option>
                <option value="live">Live key</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCOPES.map(([scope, label]) => (
                <label key={scope} className="flex items-start gap-2 text-xs text-gray-300">
                  <input type="checkbox" className="mt-0.5" checked={keyForm.permissions.includes(scope)} onChange={() => setKeyForm({ ...keyForm, permissions: toggle(keyForm.permissions, scope) })} />
                  <span>
                    <span className="font-mono text-white">{scope}</span>
                    <span className="block text-gray-500">{label}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">
              {keyForm.mode === "test"
                ? "A test key makes documents marked TEST. They are not counted against your plan and nobody is emailed; the API gives you each signer's link instead."
                : "A live key sends real documents to real people and counts them against your plan."}
            </p>
            <button className={primary} disabled={busy === "key" || !hasApi || keyForm.permissions.length === 0}>
              Create key
            </button>
          </form>
        </section>

        {/* Webhooks */}
        <section className={card} data-testid="webhooks">
          <h2 className="text-sm font-bold text-white">Webhooks</h2>
          <p className="text-xs text-gray-400 mt-1">PactDoc posts to your address when something happens to a document. A failed delivery is retried several times, with longer waits between.</p>
          {webhooks.length > 0 && (
            <ul className="mt-3 space-y-3">
              {webhooks.map((hook) => (
                <li key={hook.id} className="border border-white/10 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-mono break-all">{hook.url}</p>
                      <p className="text-[11px] text-gray-500">{(hook.events || []).join(", ")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className={quiet} onClick={() => showDeliveries(hook.id)}>
                        {deliveries[hook.id] ? "Hide deliveries" : "Deliveries"}
                      </button>
                      <button
                        className={quiet}
                        onClick={() => setConfirm({ title: "Delete this webhook?", message: `PactDoc will stop posting to ${hook.url}.`, confirmText: "Delete", run: () => deleteWebhookApi(hook.id) })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {deliveries[hook.id] && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      {deliveries[hook.id].length === 0 ? (
                        <p className="text-xs text-gray-400">Nothing has been sent to this address in the last 30 days.</p>
                      ) : (
                        <ul className="space-y-2">
                          {deliveries[hook.id].map((delivery) => (
                            <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-gray-300">
                                <span className={delivery.status === "delivered" ? "text-emerald-400" : delivery.status === "failed" ? "text-red-400" : "text-amber-300"}>{delivery.status}</span>
                                {" · "}
                                <span className="font-mono">{delivery.event}</span>
                                {" · "}
                                {when(delivery.createdAt)}
                                {delivery.responseStatus ? ` · answered ${delivery.responseStatus}` : ""}
                                {delivery.lastError ? ` · ${delivery.lastError}` : ""}
                              </span>
                              <button className={quiet} onClick={() => replay(hook.id, delivery.id)}>
                                Send again
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={createHook} className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <input className={inputClass} type="url" required placeholder="https://example.com/webhooks/pactdoc" value={hookForm.url} onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENTS.map(([name, label]) => (
                <label key={name} className="flex items-start gap-2 text-xs text-gray-300">
                  <input type="checkbox" className="mt-0.5" checked={hookForm.events.includes(name)} onChange={() => setHookForm({ ...hookForm, events: toggle(hookForm.events, name) })} />
                  <span>
                    <span className="font-mono text-white">{name}</span>
                    <span className="block text-gray-500">{label}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">The address must use https and be reachable from the internet.</p>
            <button className={primary} disabled={busy === "hook" || !hasApi || hookForm.events.length === 0}>
              Add webhook
            </button>
          </form>
        </section>

        <section className={card}>
          <h2 className="text-sm font-bold text-white">Using the API</h2>
          <p className="text-xs text-gray-400 mt-1">Send the key with every request. Start with a test key.</p>
          <pre className="mt-3 p-3 bg-black/50 rounded-xl text-[11px] text-gray-200 overflow-x-auto">{`curl ${import.meta.env.VITE_API_BASE_URL}/api/v1/me \\
  -H "Authorization: Bearer pd_test_..."`}</pre>
          <p className="text-xs text-gray-400 mt-3">
            To show a signing page inside your own website, list the website under the team's Rules first, then ask the API for an embedded signing address for the signer.
          </p>
        </section>
      </main>

      <ConfirmModal
        isOpen={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm;
          setConfirm(null);
          try {
            await action.run();
            await load();
          } catch (err) {
            toast.error(messageOf(err, "That did not work"));
          }
        }}
      />
    </div>
  );
}
