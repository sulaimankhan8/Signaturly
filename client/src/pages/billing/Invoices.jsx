import { useState } from "react";
import toast from "react-hot-toast";
import { useBilling } from "./useBilling";
import { saveBillingProfileApi } from "../../api/billing.api";
import InvoiceTable from "../../components/billing/InvoiceTable";
import InvoiceDetailsFields from "../../components/billing/InvoiceDetailsFields";
import { BTN, PANEL, ICONS } from "../../components/billing/theme";

/**
 * Billing's Invoices tab: every payment's invoice or receipt, and the details printed on them.
 */
export default function Invoices() {
  const { invoices, profile, setProfile } = useBilling();
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setProfile(await saveBillingProfileApi(profile));
      toast.success("Invoice details saved.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Those details could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <section aria-labelledby="invoices-heading" className={`${PANEL} overflow-hidden`} data-testid="billing-invoices">
        <div className="flex items-center gap-3 px-6 py-4">
          <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl border-2 border-black bg-red-600 text-white shadow-[2px_2px_0px_0px_#000]" aria-hidden="true">
            <ICONS.receipt className="w-5 h-5" />
          </span>
          <div>
            <h2 id="invoices-heading" className="text-lg font-black uppercase tracking-tight text-white">
              Invoices
            </h2>
            <p className="text-xs text-gray-400">One for every payment: plans, renewals, extra documents and wallet credit.</p>
          </div>
        </div>
        <InvoiceTable invoices={invoices} />
      </section>

      <section aria-labelledby="details-heading" className={`${PANEL} shadow-[5px_5px_0px_0px_#facc15] p-6`}>
        <h2 id="details-heading" className="text-lg font-black uppercase tracking-tight text-white">
          Invoice details
        </h2>
        <p className="mt-1 text-xs text-gray-400 leading-relaxed">Add your GST number to claim input tax credit. Changes apply to new invoices; issued invoices stay as they are.</p>
        <form onSubmit={save} className="mt-5">
          <InvoiceDetailsFields profile={profile} onChange={setProfile} stacked />
          <button type="submit" disabled={saving} className={`${BTN.primary} w-full mt-5`}>
            {saving ? "Saving…" : "Save details"}
          </button>
        </form>
      </section>
    </div>
  );
}
