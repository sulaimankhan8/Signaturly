import { STATES } from "../../utils/billing";
import { INPUT, LABEL } from "./theme";

/**
 * The details printed on an account's invoices: a name, a GST number if the buyer has one, an
 * address and the state. With a GST number the state is the one it names. Used under Invoices,
 * and at checkout so the invoice for that very payment carries them.
 */
export default function InvoiceDetailsFields({ profile, onChange, idPrefix = "invoice" }) {
  const set = (field) => (event) => onChange({ ...profile, [field]: field === "gstin" ? event.target.value.toUpperCase() : event.target.value });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor={`${idPrefix}-name`} className={LABEL}>
          Name on the invoice
        </label>
        <input id={`${idPrefix}-name`} className={INPUT} value={profile.legalName} maxLength={120} autoComplete="organization" onChange={set("legalName")} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-gstin`} className={LABEL}>
          GST number (optional)
        </label>
        <input id={`${idPrefix}-gstin`} className={`${INPUT} uppercase font-mono`} value={profile.gstin} maxLength={15} placeholder="27ABCDE1234F1Z5" onChange={set("gstin")} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-address`} className={LABEL}>
          Address
        </label>
        <input id={`${idPrefix}-address`} className={INPUT} value={profile.address} maxLength={300} autoComplete="street-address" onChange={set("address")} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-state`} className={LABEL}>
          State
        </label>
        <select id={`${idPrefix}-state`} className={INPUT} value={profile.gstin ? profile.gstin.slice(0, 2) : profile.stateCode} disabled={Boolean(profile.gstin)} onChange={set("stateCode")}>
          <option value="">Choose…</option>
          {STATES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
