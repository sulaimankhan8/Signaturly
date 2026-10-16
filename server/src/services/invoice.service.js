import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Invoice } from "../models/Invoice.model.js";
import { Payment } from "../models/Payment.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { GST_RATE_PERCENT, SAC_CODE, PLANS, TOPUP_PACKS, isPlan, isTopUpPack, priceOf } from "../config/plans.js";
import { drawShapedText, isPlainLatin, measureText } from "./textShaping.service.js";
import { formatDate } from "../utils/format.js";
import { drawBrandMark } from "../utils/brandMark.js";

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
  if (payment.kind === "purchase" || payment.kind === "renewal") {
    const plan = isPlan(payment.plan) ? PLANS[payment.plan] : null;
    const seats = plan?.perSeat ? `, ${payment.seats || 1} seat${(payment.seats || 1) === 1 ? "" : "s"}` : "";
    const period = plan?.interval ? `, one ${plan.interval}` : "";
    // A pack of extra documents bought in the same payment as the plan
    const pack = isTopUpPack(payment.item) ? `, with ${TOPUP_PACKS[payment.item].documents} extra documents` : "";
    return `PactDoc ${plan?.name || payment.plan || ""} plan${seats}${period}${pack}`.replace("  ", " ");
  }
  if (payment.kind === "topup" && isTopUpPack(payment.item)) {
    const each = TOPUP_PACKS[payment.item].documents;
    const packs = payment.quantity > 1 ? payment.quantity : 1;
    // Several packs in one payment: the total first, then how it is made up
    return packs > 1 ? `${each * packs} extra documents (${packs} packs of ${each})` : `${each} extra documents`;
  }
  // Wallet credit is for exactly what was paid, whether a set amount or one the customer chose
  if (payment.kind === "wallet") return `Wallet credit of Rs. ${payment.amount}`;
  const known = priceOf(payment.kind, payment.item);
  if (known) return known.description;
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

// 1,23,456.00: the figure without its currency sign, which is drawn on its own (see renderInvoicePdf)
const figureOf = (paise) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100);

// GST state codes, for "Place of supply"
const STATE_NAMES = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
  "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};
export const stateLabel = (code) => (code ? `${STATE_NAMES[code] || "State"} (${code})` : "");

// ----- amounts in words, in the Indian way: lakh and crore -----

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const belowHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`);
const belowThousand = (n) => [Math.floor(n / 100) ? `${ONES[Math.floor(n / 100)]} Hundred` : "", n % 100 ? belowHundred(n % 100) : ""].filter(Boolean).join(" ");

export const indianWords = (whole) => {
  let n = Math.floor(Math.abs(whole));
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  return [crore ? `${indianWords(crore)} Crore` : "", lakh ? `${belowHundred(lakh)} Lakh` : "", thousand ? `${belowHundred(thousand)} Thousand` : "", n ? belowThousand(n) : ""].filter(Boolean).join(" ");
};

// "Rupees Two Hundred Ninety-Nine Only", with paise where there are any
export const amountInWords = (paise) => {
  const rupeesPart = Math.floor(paise / 100);
  const paisePart = Math.round(paise % 100);
  return `Rupees ${indianWords(rupeesPart)}${paisePart ? ` and ${belowHundred(paisePart)} Paise` : ""} Only`;
};

/**
 * The invoice as a one-page A4 PDF, laid out the way invoices from payment companies are: who
 * issued it, the document's number, dates and payment reference in one band, who it is billed
 * to beside the amount paid, the items, the tax worked out line by line, the amount in words,
 * and the notes a GST invoice must carry. Text is real text (it can be searched and copied);
 * names in Indian scripts, and the rupee sign, are drawn from the bundled Noto fonts.
 */
export const renderInvoicePdf = async (invoice) => {
  const doc = await PDFDocument.create();
  const W = 595.28;
  const H = 841.89;
  const page = doc.addPage([W, H]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const payment = invoice.paymentId ? await Payment.findById(invoice.paymentId).select("provider providerPaymentId occurredAt").lean() : null;

  const taxInvoice = invoice.kind === "tax_invoice";
  const ink = rgb(0.07, 0.08, 0.11);
  const muted = rgb(0.42, 0.45, 0.5);
  const rule = rgb(0.87, 0.88, 0.9);
  const panel = rgb(0.965, 0.969, 0.976);
  const accent = rgb(0.863, 0.149, 0.149);
  const paidInk = rgb(0.08, 0.5, 0.24);
  const paidFill = rgb(0.86, 0.97, 0.9);
  const M = 48;
  const R = W - M;

  // ----- drawing helpers -----
  const widthOf = (text, size, font = regular) => {
    const value = String(text ?? "");
    return isPlainLatin(value) ? font.widthOfTextAtSize(value, size) : measureText(value, size, { bold: font === bold });
  };
  // One line of text; `align` "right" puts its end at x
  const write = (text, x, y, { size = 9.5, font = regular, color = ink, align = "left" } = {}) => {
    const value = String(text ?? "");
    if (!value) return 0;
    const width = widthOf(value, size, font);
    const at = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    if (isPlainLatin(value)) page.drawText(value, { x: at, y, size, font, color });
    else drawShapedText(page, value, { x: at, y, size, color, bold: font === bold });
    return width;
  };
  // Words laid into lines no wider than `width`
  const wrap = (text, width, size, font = regular) => {
    const lines = [];
    for (const paragraph of String(text ?? "").split(/\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = current ? `${current} ${word}` : word;
        if (current && widthOf(next, size, font) > width) {
          lines.push(current);
          current = word;
        } else current = next;
      }
      if (current) lines.push(current);
    }
    return lines;
  };
  // An amount with the rupee sign, its end at x. The sign comes from Noto Sans: the built-in fonts have none.
  const money = (paise, x, y, { size = 9.5, font = regular, color = ink } = {}) => {
    const figure = figureOf(paise);
    const figureWidth = font.widthOfTextAtSize(figure, size);
    const signWidth = measureText("₹", size, { bold: font === bold });
    page.drawText(figure, { x: x - figureWidth, y, size, font, color });
    drawShapedText(page, "₹", { x: x - figureWidth - signWidth - size * 0.12, y, size, color, bold: font === bold });
  };
  const hr = (y, from = M, to = R, color = rule, thickness = 0.7) => page.drawLine({ start: { x: from, y }, end: { x: to, y }, thickness, color });
  // A rectangle with rounded corners, its top-left corner at (x, top)
  const box = (x, top, width, height, { color, border, radius = 8 } = {}) => {
    const r = Math.min(radius, width / 2, height / 2);
    const d = `M ${r} 0 H ${width - r} Q ${width} 0 ${width} ${r} V ${height - r} Q ${width} ${height} ${width - r} ${height} H ${r} Q 0 ${height} 0 ${height - r} V ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(d, { x, y: top, color, borderColor: border, borderWidth: border ? 0.8 : 0 });
  };
  const label = (text, x, y, align = "left") => write(String(text).toUpperCase(), x, y, { size: 7, font: bold, color: muted, align });

  // ----- the brand band and the document's title -----
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: accent });

  let y = H - 62;
  // The mark, then the name, its capitals centred on the mark
  drawBrandMark(page, { x: M, top: y + 24, size: 31 });
  const pactWidth = write("Pact", M + 40, y, { size: 24, font: bold });
  write("Doc", M + 40 + pactWidth, y, { size: 24, font: bold, color: accent });
  write(taxInvoice ? "TAX INVOICE" : "RECEIPT", R, y + 2, { size: 19, font: bold, align: "right" });

  // Paid: a stamp under the title
  const stamp = "PAID";
  const stampWidth = bold.widthOfTextAtSize(stamp, 8.5) + 22;
  box(R - stampWidth, y - 12, stampWidth, 18, { color: paidFill, radius: 9 });
  page.drawCircle({ x: R - stampWidth + 9, y: y - 21, size: 2.6, color: paidInk });
  write(stamp, R - 7, y - 24.2, { size: 8.5, font: bold, color: paidInk, align: "right" });
  if (taxInvoice) write("Original for recipient", R, y - 40, { size: 8, color: muted, align: "right" });

  // Who issued it: the legal name under the brand, unless it is only the brand again
  let left = y - 14;
  const sellerName = invoice.seller?.name && invoice.seller.name !== env.appName ? invoice.seller.name : "";
  if (sellerName) {
    left -= 12;
    write(sellerName, M, left, { size: 10, font: bold });
  }
  const sellerLines = [...wrap(invoice.seller?.address, 250, 8.5), invoice.seller?.gstin ? `GSTIN ${invoice.seller.gstin}` : "", invoice.seller?.stateCode ? `State: ${stateLabel(invoice.seller.stateCode)}` : ""].filter(Boolean);
  for (const row of sellerLines) {
    left -= 12;
    write(row, M, left, { size: 8.5, color: muted });
  }
  y = Math.min(left, y - (taxInvoice ? 44 : 26)) - 24;

  // ----- number, date, how it was paid, and the payment's reference, in one band -----
  const simulated = String(payment?.providerPaymentId || "").startsWith("sim_");
  const facts = [
    [taxInvoice ? "Invoice number" : "Receipt number", invoice.number, bold],
    ["Date of issue", formatDate(invoice.issuedAt), bold],
    ["Paid with", simulated ? "Simulated (test)" : payment?.provider === "razorpay" ? "Razorpay" : payment?.provider ? payment.provider[0].toUpperCase() + payment.provider.slice(1) : "-", bold],
    ["Payment reference", payment?.providerPaymentId || "-", mono],
  ];
  const bandHeight = 50;
  box(M, y, R - M, bandHeight, { color: panel, radius: 10 });
  const column = (R - M - 32) / facts.length;
  facts.forEach(([title, value, font], index) => {
    const x = M + 16 + index * column;
    label(title, x, y - 18);
    // Shrunk to fit its column where a reference is long
    let size = font === mono ? 8.5 : 9.5;
    while (size > 6 && widthOf(value, size, font) > column - 10) size -= 0.5;
    write(value, x, y - 34, { size, font });
  });
  y -= bandHeight + 30;

  // ----- billed to, beside the amount paid -----
  const top = y;
  label("Billed to", M, y);
  y -= 16;
  write(invoice.buyer?.name || invoice.buyer?.email || "-", M, y, { size: 11, font: bold });
  const buyerLines = [...wrap(invoice.buyer?.address, 250, 9), invoice.buyer?.email && invoice.buyer?.name ? invoice.buyer.email : "", invoice.buyer?.gstin ? `GSTIN ${invoice.buyer.gstin}` : "", invoice.buyer?.stateCode ? `State: ${stateLabel(invoice.buyer.stateCode)}` : ""].filter(Boolean);
  for (const row of buyerLines) {
    y -= 13;
    write(row, M, y, { size: 9, color: row.startsWith("GSTIN") ? ink : muted });
  }

  const heroX = W / 2 + 40;
  let hero = top;
  label("Amount paid", heroX, hero);
  hero -= 26;
  money(invoice.totalPaise, heroX + widthOf(figureOf(invoice.totalPaise), 24, bold) + measureText("₹", 24, { bold: true }) + 3, hero, { size: 24, font: bold });
  hero -= 15;
  write(`on ${formatDate(payment?.occurredAt || invoice.issuedAt)}`, heroX, hero, { size: 9, color: muted });
  if (taxInvoice) {
    hero -= 22;
    label("Place of supply", heroX, hero);
    write(stateLabel(invoice.buyer?.stateCode || invoice.seller?.stateCode) || "-", heroX + 92, hero, { size: 9 });
    hero -= 14;
    label("Reverse charge", heroX, hero);
    write("No", heroX + 92, hero, { size: 9 });
  }
  y = Math.min(y, hero) - 30;

  // ----- the items -----
  const colNumber = M + 12;
  const colDescription = M + 36;
  const colSac = 382;
  const colAmount = R - 12;
  const descriptionWidth = colSac - colDescription - 16;
  box(M, y + 8, R - M, 24, { color: panel, radius: 6 });
  label("#", colNumber, y - 7);
  label("Description", colDescription, y - 7);
  label("SAC", colSac, y - 7);
  label(taxInvoice ? "Taxable value" : "Amount", colAmount, y - 7, "right");
  y -= 22;

  invoice.lines.forEach((item, index) => {
    const lines = wrap(item.description, descriptionWidth, 9.5);
    y -= 16;
    write(String(index + 1), colNumber, y, { size: 9.5, color: muted });
    lines.forEach((row, at) => write(row, colDescription, y - at * 13, { size: 9.5, font: bold }));
    write(item.sac || "", colSac, y, { size: 9.5, color: muted });
    money(item.amountPaise, colAmount, y, { size: 9.5 });
    y -= (lines.length - 1) * 13 + 12;
    hr(y);
  });

  // ----- totals, with the amount in words beside them -----
  y -= 22;
  const totalsLeft = R - 232;
  const sumTop = y;
  const sum = (title, paise, { strong = false, size = 9.5 } = {}) => {
    write(title, totalsLeft, y, { size, font: strong ? bold : regular, color: strong ? ink : muted });
    money(paise, colAmount, y, { size, font: strong ? bold : regular });
    y -= strong ? 20 : 16;
  };
  if (taxInvoice) {
    sum("Taxable value", invoice.taxableValuePaise);
    for (const tax of invoice.taxes) sum(`${tax.name} @ ${tax.ratePercent}%`, tax.amountPaise);
  } else {
    sum("Subtotal", invoice.taxableValuePaise);
  }
  hr(y + 9, totalsLeft, R);
  y -= 6;
  sum("Total", invoice.totalPaise, { strong: true, size: 11.5 });
  sum("Amount paid", invoice.totalPaise);
  box(totalsLeft - 8, y + 12, R - totalsLeft + 8, 22, { color: paidFill, radius: 6 });
  write("Balance due", totalsLeft, y - 3, { size: 9.5, font: bold, color: paidInk });
  money(0, colAmount, y - 3, { size: 9.5, font: bold, color: paidInk });
  const totalsBottom = y - 18;

  let words = sumTop;
  label("Amount in words", M, words);
  for (const row of wrap(amountInWords(invoice.totalPaise), totalsLeft - M - 36, 9.5, bold)) {
    words -= 14;
    write(row, M, words, { size: 9.5, font: bold });
  }
  words -= 22;
  write(`Thank you for choosing ${env.appName}.`, M, words, { size: 9, color: muted });
  y = Math.min(totalsBottom, words) - 30;

  // ----- notes -----
  const notes = taxInvoice
    ? [
        `Prices include GST at ${invoice.taxes.reduce((all, tax) => all + tax.ratePercent, 0)}%. ${invoice.taxes.length > 1 ? "Supplier and recipient are in the same state, so the tax is split into CGST and SGST." : "Supplier and recipient are in different states, so IGST is charged."}`,
        "Tax is not payable under reverse charge.",
        "This is a computer-generated invoice and needs no signature.",
      ]
    : [`${invoice.seller?.name || env.appName} is not registered for GST yet, so no GST is charged and this is a receipt, not a tax invoice.`, "This is a computer-generated receipt and needs no signature."];
  const noteLines = notes.flatMap((note) => wrap(note, R - M - 32, 8.5));
  const notesHeight = 30 + noteLines.length * 12;
  box(M, y, R - M, notesHeight, { color: rgb(1, 1, 1), border: rule, radius: 10 });
  label("Notes", M + 16, y - 18);
  noteLines.forEach((row, index) => write(row, M + 16, y - 32 - index * 12, { size: 8.5, color: muted }));

  // ----- footer -----
  hr(58);
  const site = String(env.appUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  write(`${env.appName}${site ? ` · ${site}` : ""}`, M, 42, { size: 8, color: muted });
  write("Questions about this document? support@pactdoc.com", R, 42, { size: 8, color: muted, align: "right" });

  doc.setTitle(`${taxInvoice ? "Tax invoice" : "Receipt"} ${invoice.number}`);
  doc.setAuthor(invoice.seller?.name || env.appName);
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
