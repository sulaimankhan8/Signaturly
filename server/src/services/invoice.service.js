import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Invoice } from "../models/Invoice.model.js";
import { Payment } from "../models/Payment.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { GST_RATE_PERCENT, SAC_CODE, priceOf } from "../config/plans.js";
import { drawShapedText, isPlainLatin } from "./textShaping.service.js";
import { formatDate } from "../utils/format.js";

/**
 * Invoices for payments (plan task P4-16).
 *
 * Prices include GST, so the tax is worked out from the amount paid, and an invoice's total
 * always equals its payment. Numbers run without gaps within a financial year (April to March).
 */

// 15 characters: two-digit state code, ten-character PAN, entity number, "Z", check character
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const isGstin = (value) => typeof value === "string" && GSTIN.test(value.trim().toUpperCase());

// The financial year an instant falls in, in India time: "2026-27"
export const financialYearOf = (date) => {
  const india = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000);
  const year = india.getUTCMonth() >= 3 ? india.getUTCFullYear() : india.getUTCFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};

/**
 * Splits an amount that includes tax into its taxable value and tax lines.
 * Same state as the seller: half central, half state. Another state: integrated tax.
 * The parts always add up to the amount exactly.
 */
export const splitTax = (totalPaise, { sellerStateCode, buyerStateCode }) => {
  const taxable = Math.round((totalPaise * 100) / (100 + GST_RATE_PERCENT));
  const tax = totalPaise - taxable;

  // A buyer who gave no state is treated as being in the seller's state
  const sameState = !buyerStateCode || buyerStateCode === sellerStateCode;
  if (!sameState) {
    return { taxableValuePaise: taxable, taxes: [{ name: "IGST", ratePercent: GST_RATE_PERCENT, amountPaise: tax }] };
  }
  const central = Math.floor(tax / 2);
  return {
    taxableValuePaise: taxable,
    taxes: [
      { name: "CGST", ratePercent: GST_RATE_PERCENT / 2, amountPaise: central },
      { name: "SGST", ratePercent: GST_RATE_PERCENT / 2, amountPaise: tax - central },
    ],
  };
};

const sellerDetails = () => ({
  name: env.sellerLegalName || env.appName,
  address: env.sellerAddress || "",
  gstin: isGstin(env.sellerGstin) ? env.sellerGstin.trim().toUpperCase() : "",
  stateCode: env.sellerStateCode || (isGstin(env.sellerGstin) ? env.sellerGstin.trim().slice(0, 2) : ""),
});

const describe = (payment) => {
  if (payment.kind === "seats") {
    return `${payment.seats} more seat${payment.seats === 1 ? "" : "s"} on the PactDoc ${payment.plan || "Business"} plan, for the rest of the current period`;
  }
  const known = priceOf(payment.kind === "purchase" || payment.kind === "renewal" ? "plan" : payment.kind, payment.item || payment.plan, { seats: payment.seats });
  if (known) return known.description;
  if (payment.plan) return `PactDoc ${payment.plan} plan`;
  return "PactDoc services";
};

/**
 * Issues the invoice for a payment, once. Asking again returns the invoice already issued.
 * Failed payments and payments in other currencies get none.
 */
export const issueInvoiceForPayment = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new ApiError(404, "Payment not found");
  if (payment.kind === "failed" || !(payment.amount > 0)) return null;
  if (String(payment.currency || "").toUpperCase() !== "INR") return null;

  const existing = await Invoice.findOne({ paymentId: payment._id });
  if (existing) return existing;

  const user = await User.findById(payment.userId);
  const seller = sellerDetails();
  const billing = user?.billing || {};
  const buyer = {
    name: billing.legalName || user?.name || "",
    email: user?.email || "",
    address: billing.address || "",
    gstin: isGstin(billing.gstin) ? billing.gstin : "",
    stateCode: billing.stateCode || (isGstin(billing.gstin) ? billing.gstin.slice(0, 2) : ""),
  };

  const totalPaise = Math.round(payment.amount * 100);
  const issuedAt = payment.occurredAt || new Date();
  const kind = seller.gstin ? "tax_invoice" : "receipt";
  const { taxableValuePaise, taxes } =
    kind === "tax_invoice"
      ? splitTax(totalPaise, { sellerStateCode: seller.stateCode, buyerStateCode: buyer.stateCode })
      : { taxableValuePaise: totalPaise, taxes: [] };

  const series = `${kind === "tax_invoice" ? "PD" : "PR"}/${financialYearOf(issuedAt)}`;

  // The next number is the last one plus one, and the unique index lets only one request take it.
  // A number is used only by an invoice that was really written, so the series has no gaps.
  for (let attempt = 0; attempt < 50; attempt++) {
    const last = await Invoice.findOne({ series }).sort({ sequence: -1 }).select("sequence").lean();
    const sequence = (last?.sequence || 0) + 1;
    try {
      return await Invoice.create({
        number: `${series}/${String(sequence).padStart(6, "0")}`,
        series,
        sequence,
        kind,
        userId: payment.userId,
        paymentId: payment._id,
        issuedAt,
        seller,
        buyer,
        lines: [{ description: describe(payment), sac: SAC_CODE, amountPaise: taxableValuePaise }],
        taxableValuePaise,
        taxes,
        totalPaise,
        currency: "INR",
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Either another request issued this payment's invoice, or took this number
      const mine = await Invoice.findOne({ paymentId: payment._id });
      if (mine) return mine;
      await new Promise((resolve) => setTimeout(resolve, 5 + Math.random() * 20));
    }
  }
  throw new Error("Could not allocate an invoice number");
};

export const listInvoices = async (userId) =>
  (await Invoice.find({ userId }).sort({ issuedAt: -1, sequence: -1 }).lean()).map((invoice) => ({
    id: invoice._id,
    number: invoice.number,
    kind: invoice.kind,
    issuedAt: invoice.issuedAt,
    description: invoice.lines[0]?.description || "",
    totalPaise: invoice.totalPaise,
  }));

export const getInvoice = async (id, userId) => {
  const invoice = /^[a-f0-9]{24}$/i.test(String(id)) ? await Invoice.findOne({ _id: String(id), userId }).lean() : null;
  if (!invoice) throw new ApiError(404, "Invoice not found");
  return invoice;
};

const rupees = (paise) => `Rs. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)}`;

/**
 * The invoice as a one-page PDF.
 */
export const renderInvoicePdf = async (invoice) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.42, 0.46);
  const rule = rgb(0.8, 0.82, 0.85);
  const left = 56;
  const right = 595.28 - 56;

  const write = (text, x, y, { size = 10, font = regular, color = ink, alignRight = false } = {}) => {
    const value = String(text ?? "");
    if (!isPlainLatin(value)) {
      drawShapedText(page, value, { x, y, size, color, bold: font === bold });
      return;
    }
    page.drawText(value, { x: alignRight ? x - font.widthOfTextAtSize(value, size) : x, y, size, font, color });
  };
  const line = (y) => page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: rule });

  let y = 780;
  write(invoice.kind === "tax_invoice" ? "Tax Invoice" : "Receipt", left, y, { size: 18, font: bold });
  write(invoice.number, right, y, { size: 11, font: bold, alignRight: true });
  y -= 16;
  write(`Date: ${formatDate(invoice.issuedAt)}`, right, y, { size: 9.5, color: muted, alignRight: true });

  y -= 30;
  const party = (title, details, x) => {
    let cursor = y;
    write(title, x, cursor, { size: 8.5, font: bold, color: muted });
    cursor -= 14;
    write(details.name || "-", x, cursor, { font: bold });
    for (const row of [details.address, details.email, details.gstin ? `GSTIN: ${details.gstin}` : "", details.stateCode ? `State code: ${details.stateCode}` : ""]) {
      if (!row) continue;
      for (const part of String(row).match(/.{1,46}(\s|$)/g) || [row]) {
        cursor -= 13;
        write(part.trim(), x, cursor, { size: 9.5 });
      }
    }
    return cursor;
  };
  const afterSeller = party("FROM", invoice.seller, left);
  const afterBuyer = party("TO", invoice.buyer, 320);
  y = Math.min(afterSeller, afterBuyer) - 28;

  line(y + 12);
  write("Description", left, y, { size: 9, font: bold, color: muted });
  write("SAC", 380, y, { size: 9, font: bold, color: muted });
  write("Amount", right, y, { size: 9, font: bold, color: muted, alignRight: true });
  y -= 8;
  line(y);

  for (const item of invoice.lines) {
    y -= 18;
    write(item.description, left, y);
    write(item.sac || "", 380, y);
    write(rupees(item.amountPaise), right, y, { alignRight: true });
  }
  y -= 12;
  line(y);

  const total = (label, paise, options = {}) => {
    y -= 18;
    write(label, 380, y, options);
    write(rupees(paise), right, y, { ...options, alignRight: true });
  };
  if (invoice.kind === "tax_invoice") {
    total("Taxable value", invoice.taxableValuePaise);
    for (const tax of invoice.taxes) total(`${tax.name} at ${tax.ratePercent}%`, tax.amountPaise);
  }
  total("Total paid", invoice.totalPaise, { font: bold, size: 11 });

  y -= 40;
  write(
    invoice.kind === "tax_invoice"
      ? "Prices include GST. This is a computer-generated invoice."
      : "The seller is not registered for GST, so no tax is charged or shown. This is a computer-generated receipt.",
    left,
    y,
    { size: 8.5, color: muted }
  );

  doc.setTitle(`${invoice.kind === "tax_invoice" ? "Tax invoice" : "Receipt"} ${invoice.number}`);
  doc.setProducer(env.appName);
  return Buffer.from(await doc.save());
};

const INDIAN_STATE_CODE = /^(0[1-9]|[12][0-9]|3[0-8]|97)$/;

/**
 * Checks and tidies the details a customer wants on their invoices.
 */
export const cleanBillingProfile = (input) => {
  const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const gstin = text(input?.gstin, 15).toUpperCase();
  if (gstin && !isGstin(gstin)) throw new ApiError(400, "That GST number is not in the right form. It has 15 characters, such as 27ABCDE1234F1Z5.");

  const stateCode = gstin ? gstin.slice(0, 2) : text(input?.stateCode, 2);
  if (stateCode && !INDIAN_STATE_CODE.test(stateCode)) throw new ApiError(400, "Choose a state from the list");

  return { legalName: text(input?.legalName, 120), address: text(input?.address, 300), gstin, stateCode };
};
