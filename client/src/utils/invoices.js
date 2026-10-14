import toast from "react-hot-toast";
import { downloadInvoiceApi } from "../api/billing.api";

// Fetches the PDF with the sign-in header, then hands it to the browser to save
export const downloadInvoice = async (invoice) => {
  try {
    const blob = await downloadInvoiceApi(invoice.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.number.replace(/\//g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("The invoice could not be downloaded.");
  }
};
