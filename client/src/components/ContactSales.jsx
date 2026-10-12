import { useState } from "react";
import { sendSalesEnquiryApi } from "../api/billing.api";

const input = "w-full px-3 py-2.5 bg-[#08090d] border-2 border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500";
const label = "block text-[11px] uppercase font-bold text-gray-500 mb-1.5";

const SIZES = [
  ["", "Choose"],
  ["1-10", "1 to 10"],
  ["11-50", "11 to 50"],
  ["51-200", "51 to 200"],
  ["201+", "More than 200"],
];

/**
 * "Contact sales", for a plan whose price is agreed and not paid with a button (Enterprise).
 * The enquiry is kept on the server and reaches us there, so nothing depends on the visitor
 * having an email program set up.
 *
 * `plan` is the plan the form was opened from. `user` is whoever is signed in, if anyone:
 * their name and address are filled in to begin with.
 */
export default function ContactSales({ open, plan, user = null, onClose }) {
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", company: "", teamSize: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const set = (field) => (event) => setForm((old) => ({ ...old, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setError("Tell us your name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter the email address we should write to.");
    try {
      setBusy(true);
      setError("");
      await sendSalesEnquiryApi({ ...form, plan: plan?.id || "" });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "That could not be sent. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Contact sales" data-testid="contact-sales">
      <div className="bg-[#12141c] border border-white/15 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 text-left">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">{sent ? "Thank you" : `Talk to us about ${plan?.name || "a plan"}`}</h2>
            <p className="text-xs text-gray-400 mt-1">{sent ? "We have your enquiry and will write to you soon." : "Tell us a little about what you need. We reply by email, usually within one working day."}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {sent ? (
          <button type="button" onClick={onClose} className="mt-6 w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold border-2 border-white/15">
            Close
          </button>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {error && (
              <p role="alert" className="px-4 py-3 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-red-100 text-xs">
                {error}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sales-name" className={label}>
                  Your name
                </label>
                <input id="sales-name" value={form.name} onChange={set("name")} maxLength={80} autoComplete="name" className={input} />
              </div>
              <div>
                <label htmlFor="sales-email" className={label}>
                  Work email
                </label>
                <input id="sales-email" type="email" value={form.email} onChange={set("email")} maxLength={254} autoComplete="email" className={input} />
              </div>
              <div>
                <label htmlFor="sales-company" className={label}>
                  Company
                </label>
                <input id="sales-company" value={form.company} onChange={set("company")} maxLength={120} autoComplete="organization" className={input} />
              </div>
              <div>
                <label htmlFor="sales-size" className={label}>
                  People who would use it
                </label>
                <select id="sales-size" value={form.teamSize} onChange={set("teamSize")} className={input}>
                  {SIZES.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="sales-message" className={label}>
                What do you need?
              </label>
              <textarea id="sales-message" value={form.message} onChange={set("message")} maxLength={2000} rows={4} className={input} placeholder="How many documents a month, single sign-on, anything particular about your contracts…" />
            </div>
            {/* Left empty by people, who never see it; filled in by programs that fill in every box */}
            <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

            <button type="submit" disabled={busy} className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold">
              {busy ? "Sending…" : "Send to sales"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
