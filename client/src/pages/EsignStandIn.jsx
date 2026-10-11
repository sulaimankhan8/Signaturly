import { useState } from "react";
import { useParams } from "react-router-dom";
import { reportEsignStandInApi } from "../api/signing.api";

/**
 * Development only: the page that stands in for an Aadhaar eSign provider's own page.
 * It exists so the signing flow can be tried before a licensed provider is connected.
 * It asks for no Aadhaar number, and nothing done here has legal effect.
 * The server refuses it in production.
 */
export default function EsignStandIn() {
  const { transactionId } = useParams();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  // Only a page of this site is ever returned to
  const back = (() => {
    const target = new URLSearchParams(window.location.search).get("return") || "";
    try {
      const url = new URL(target);
      return url.origin === window.location.origin && url.pathname.startsWith("/sign/") ? url.toString() : null;
    } catch {
      return null;
    }
  })();

  const answer = async (outcome) => {
    setBusy(true);
    setProblem("");
    try {
      await reportEsignStandInApi(transactionId, { outcome, name });
      window.location.assign(back || "/");
    } catch (err) {
      setProblem(err.response?.data?.message || "That could not be recorded");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 text-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border-2 border-amber-400 rounded-2xl p-6 space-y-4" data-testid="esign-stand-in">
        <p className="inline-block px-2 py-1 bg-amber-400 text-black text-[11px] font-black uppercase rounded">Stand-in · development only</p>
        <h1 className="text-xl font-black">This is not Aadhaar eSign</h1>
        <p className="text-sm text-gray-700">
          It stands in for the provider's page while the service is being built. Do not enter an Aadhaar number anywhere on this site. A signature approved here has no legal effect.
        </p>
        <label className="block text-xs font-bold text-gray-700">
          Name the certificate would carry
          <input className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="As on the signer's Aadhaar" />
        </label>
        {problem && <p className="text-sm text-red-600">{problem}</p>}
        <div className="flex gap-3">
          <button disabled={busy || !name.trim()} onClick={() => answer("signed")} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold">
            Approve
          </button>
          <button disabled={busy} onClick={() => answer("failed")} className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-40 text-gray-900 rounded-xl text-sm font-bold">
            Fail
          </button>
        </div>
      </div>
    </div>
  );
}
