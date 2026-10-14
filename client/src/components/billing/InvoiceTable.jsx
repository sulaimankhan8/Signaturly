import { downloadInvoice } from "../../utils/invoices";
import { rupeesFromPaise } from "../../utils/checkout";
import { day } from "../../utils/billing";
import { ICONS } from "./theme";

const cell = "px-3 py-3.5 border-t border-white/[0.06]";

/**
 * Payments, newest first, each with its invoice (or, for wallet credit, its receipt) to
 * download. `limit` shows only the latest few.
 */
export default function InvoiceTable({ invoices, limit = null }) {
  const shown = limit ? invoices.slice(0, limit) : invoices;
  if (shown.length === 0) return <p className="px-6 pb-6 text-sm text-gray-400">No payments yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.05em] text-gray-400">
            <th scope="col" className="px-6 py-2.5 font-bold border-t border-white/[0.06]">
              Date
            </th>
            <th scope="col" className="px-3 py-2.5 font-bold border-t border-white/[0.06]">
              Description
            </th>
            <th scope="col" className="px-3 py-2.5 font-bold border-t border-white/[0.06]">
              Number
            </th>
            <th scope="col" className="px-3 py-2.5 font-bold text-right border-t border-white/[0.06]">
              Amount
            </th>
            <th scope="col" className="px-6 py-2.5 border-t border-white/[0.06]">
              <span className="sr-only">Download</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((invoice) => {
            const what = invoice.kind === "tax_invoice" ? "invoice" : "receipt";
            return (
              <tr key={invoice.id} className="hover:bg-white/[0.025]">
                <td className={`${cell} pl-6 text-gray-300 whitespace-nowrap`}>{day(invoice.issuedAt)}</td>
                <td className={`${cell} text-gray-100`}>{invoice.description}</td>
                <td className={`${cell} font-mono text-[13px] text-gray-400 whitespace-nowrap`}>{invoice.number}</td>
                <td className={`${cell} text-right font-bold text-white whitespace-nowrap`}>{rupeesFromPaise(invoice.totalPaise)}</td>
                <td className={`${cell} pr-6 text-right`}>
                  <button
                    type="button"
                    onClick={() => downloadInvoice(invoice)}
                    aria-label={`Download ${what} ${invoice.number}`}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-2 rounded-lg text-[13px] font-bold text-rose-300 hover:text-rose-200 hover:bg-white/5"
                  >
                    <ICONS.download className="w-4 h-4" />
                    {what === "invoice" ? "Invoice PDF" : "Receipt PDF"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
