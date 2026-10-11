import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchTwoFactorApi, beginTwoFactorApi, confirmTwoFactorApi, disableTwoFactorApi } from "../api/workspace.api";

/**
 * Two-step sign-in with an authenticator app (plan task P5-09), for the signed-in person's
 * own account. Switching it on shows the key to add to the app, asks for a code to prove it
 * worked, and then shows ten recovery codes once.
 */

const inputClass = "w-full px-3 py-2.5 bg-[#08090d] border border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500";
const primary = "px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold";
const quiet = "px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl text-xs font-bold text-gray-200";
const messageOf = (err, fallback) => err.response?.data?.message || fallback;

// The key in groups of four, which is how authenticator apps show it
const grouped = (secret) => String(secret || "").replace(/(.{4})/g, "$1 ").trim();

export default function TwoFactorSettings() {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [turningOff, setTurningOff] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => fetchTwoFactorApi().then(setStatus).catch(() => setStatus({ enabled: false }));
  useEffect(() => {
    load();
  }, []);

  const act = async (work, fallback) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      toast.error(messageOf(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const begin = () => act(async () => setSetup(await beginTwoFactorApi()), "Two-step sign-in could not be started");

  const confirm = (event) => {
    event.preventDefault();
    return act(async () => {
      const result = await confirmTwoFactorApi(code.trim());
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setCode("");
      await load();
      toast.success("Two-step sign-in is on");
    }, "That code is not right");
  };

  const disable = (event) => {
    event.preventDefault();
    return act(async () => {
      await disableTwoFactorApi(code.trim());
      setTurningOff(false);
      setCode("");
      setRecoveryCodes(null);
      await load();
      toast.success("Two-step sign-in is off");
    }, "That code is not right");
  };

  if (!status) return null;

  return (
    <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6 space-y-4" data-testid="two-factor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Two-step sign-in</h2>
          <p className="text-xs text-gray-400 mt-1">After your password, sign-in asks for a six-digit code from an authenticator app on your phone.</p>
        </div>
        <span className={`px-2 py-1 rounded text-[11px] font-bold ${status.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-gray-300"}`}>{status.enabled ? "On" : "Off"}</span>
      </div>

      {recoveryCodes && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30" data-testid="recovery-codes">
          <p className="text-xs text-amber-200 font-bold">Save these recovery codes now. They are not shown again.</p>
          <p className="text-xs text-amber-100/80 mt-1">Each one signs you in once if you lose your phone.</p>
          <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm text-white">
            {recoveryCodes.map((recovery) => (
              <li key={recovery}>{recovery}</li>
            ))}
          </ul>
          <button
            className={`${quiet} mt-3`}
            onClick={() => navigator.clipboard?.writeText(recoveryCodes.join("\n")).then(() => toast.success("Copied"))}
          >
            Copy
          </button>
        </div>
      )}

      {!status.enabled && !setup && (
        <button className={primary} disabled={busy} onClick={begin}>
          Switch on
        </button>
      )}

      {setup && (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-xs text-gray-300">
            In your authenticator app, choose "enter a setup key" and type this key. On a phone you can{" "}
            <a href={setup.otpauthUrl} className="text-red-400 font-bold">
              open the app with it
            </a>
            .
          </p>
          <code className="block px-3 py-2 bg-black/40 rounded-xl text-sm text-white tracking-wider break-all" data-testid="two-factor-key">
            {grouped(setup.secret)}
          </code>
          <input className={inputClass} inputMode="numeric" autoComplete="one-time-code" required maxLength={8} placeholder="The six-digit code the app shows" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="flex gap-2">
            <button className={primary} disabled={busy}>
              Confirm
            </button>
            <button type="button" className={quiet} onClick={() => setSetup(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {status.enabled && !turningOff && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-gray-400">{status.recoveryCodesLeft} recovery codes left.</p>
          <button className={quiet} onClick={() => setTurningOff(true)}>
            Switch off
          </button>
        </div>
      )}

      {status.enabled && turningOff && (
        <form onSubmit={disable} className="space-y-3">
          <input className={inputClass} required maxLength={12} autoComplete="one-time-code" placeholder="A code from your app, or a recovery code" value={code} onChange={(e) => setCode(e.target.value)} />
          <p className="text-[11px] text-gray-500">A team that requires two-step sign-in will stop opening for you once it is off.</p>
          <div className="flex gap-2">
            <button className={primary} disabled={busy}>
              Switch off
            </button>
            <button type="button" className={quiet} onClick={() => setTurningOff(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
