import mongoose from "mongoose";

/**
 * An invoice for one payment (plan task P4-16). Written once, never edited: a mistake is
 * corrected with a new document, as tax rules expect.
 *
 * `kind` is "tax_invoice" when the seller's GST number is configured, and "receipt" until then:
 * a business that is not registered for GST cannot issue a tax invoice or charge tax.
 */
const invoiceSchema = new mongoose.Schema(
  {
    // PD/2026-27/000001: a series per financial year, numbered with no gaps
    number: { type: String, required: true, unique: true },
    series: { type: String, required: true },
    sequence: { type: Number, required: true },
    kind: { type: String, enum: ["tax_invoice", "receipt"], required: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, unique: true },
    issuedAt: { type: Date, required: true },

    seller: {
      name: String,
      address: String,
      gstin: String,
      stateCode: String,
    },
    buyer: {
      name: String,
      email: String,
      address: String,
      gstin: String,
      stateCode: String,
    },

    lines: [{ _id: false, description: String, sac: String, amountPaise: Number }],
    // Amounts in paise. For a receipt, taxable value equals the total and there are no tax lines.
    taxableValuePaise: { type: Number, required: true },
    taxes: [{ _id: false, name: String, ratePercent: Number, amountPaise: Number }],
    totalPaise: { type: Number, required: true },
    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

invoiceSchema.index({ series: 1, sequence: 1 }, { unique: true });

const refuseChange = function () {
  throw new Error("Invoices cannot be changed or removed");
};
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "replaceOne"]) {
  invoiceSchema.pre(hook, refuseChange);
}

export const Invoice = mongoose.model("Invoice", invoiceSchema);
