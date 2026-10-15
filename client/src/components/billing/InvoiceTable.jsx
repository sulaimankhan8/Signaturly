import { downloadInvoice } from "../../utils/invoices";
import { rupeesFromPaise } from "../../utils/checkout";
import { day } from "../../utils/billing";
import { ICONS } from "./theme";

const head = "py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-400 bg-[#090a0f] border-y-2 border-white/10";
const cell = "px-3 py-3 border-t border-white/[0.07]";

/**
 * Payments, newest first, each with its invoice (or, for wallet credit, its receipt) to
 * download. `limit` shows only the latest few.
 */
export default function InvoiceTable({ invoices, limit = null }) {
  const shown = limit ? invoices.slice(0, limit) : invoices;
  if (shown.length === 0) {
    return (
      <div className="mx-6 mb-6 px-4 py-5 rounded-xl border-2 border-dashed border-white/15 text-center">
        <p className="text-sm font-bold text-gray-300">No payments yet.</p>
        <p className="mt-0.5 text-xs text-gray-500">Each payment's GST invoice or receipt appears here, ready to download.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="text-left">
            <th scope="col" className={`${head} px-6`}>
              Date
            </th>
            <th scope="col" className={`${head} px-3`}>
              Description
            </th>
            <th scope="col" className={`${head} px-3`}>
              Number
            </th>
            <th scope="col" className={`${head} px-3 text-right`}>
              Amount
            </th>
            <th scope="col" className={`${head} px-6`}>
              <span className="sr-only">Download</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((invoice) => {
            const what = invoice.kind === "tax_invoice" ? "invoice" : "receipt";
            return (
              <tr key={invoice.id} className="hover:bg-white/[0.03] transition-colors">
                <td className={`${cell} pl-6 font-mono text-xs text-gray-400 whitespace-nowrap`}>{day(invoice.issuedAt)}</td>
                <td className={`${cell} font-medium text-gray-100`}>{invoice.description}</td>
                <td className={`${cell} font-mono text-xs text-gray-400 whitespace-nowrap`}>{invoice.number}</td>
                <td className={`${cell} text-right font-black text-white tabular-nums whitespace-nowrap`}>{rupeesFromPaise(invoice.totalPaise)}</td>
                <td className={`${cell} pr-6 text-right`}>
                  <button
                    type="button"
                    onClick={() => downloadInvoice(invoice)}
                    aria-label={`Download ${what} ${invoice.number}`}
                    className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-lg border-2 border-white/15 bg-[#1e2235] hover:bg-[#282d47] hover:border-white/30 text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap transition-colors"
                  >
                    <ICONS.download className="w-3.5 h-3.5 text-red-400" />
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
