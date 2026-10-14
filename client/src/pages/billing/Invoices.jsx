import { useState } from "react";
import toast from "react-hot-toast";
import { useBilling } from "./useBilling";
import { saveBillingProfileApi } from "../../api/billing.api";
import InvoiceTable from "../../components/billing/InvoiceTable";
import InvoiceDetailsFields from "../../components/billing/InvoiceDetailsFields";
import { BTN, PANEL } from "../../components/billing/theme";

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
    <div className="grid gap-6">
      <section aria-labelledby="invoices-heading" className={`${PANEL} overflow-hidden`} data-testid="billing-invoices">
        <div className="px-6 py-5">
          <h2 id="invoices-heading" className="font-display text-xl font-bold text-white">
            Invoices
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-400">One for every payment: plans, renewals, extra documents and wallet credit.</p>
        </div>
        <InvoiceTable invoices={invoices} />
      </section>

      <section aria-labelledby="details-heading" className={`${PANEL} p-6`}>
        <h2 id="details-heading" className="font-display text-xl font-bold text-white">
          Invoice details
        </h2>
        <p className="mt-0.5 text-[13px] text-gray-400">Add your GST number to claim input tax credit. Changes apply to new invoices; issued invoices stay as they are.</p>
        <form onSubmit={save} className="mt-5">
          <InvoiceDetailsFields profile={profile} onChange={setProfile} />
          <button type="submit" disabled={saving} className={`${BTN.secondary} mt-5`}>
            {saving ? "Saving…" : "Save details"}
          </button>
        </form>
      </section>
    </div>
  );
}
