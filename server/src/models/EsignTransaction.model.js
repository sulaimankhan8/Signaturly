import mongoose from "mongoose";

/**
 * One attempt by one signer to sign with Aadhaar eSign.
 *
 * It holds what the signer filled in until the provider confirms, what was charged, and what
 * the provider reported. It never holds an Aadhaar number: that is typed on the provider's page.
 */
const esignTransactionSchema = new mongoose.Schema(
  {
    pdfId: { type: mongoose.Schema.Types.ObjectId, ref: "Pdf", required: true, index: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipient", required: true, index: true },
    provider: { type: String, required: true },
    // The provider's own name for this attempt
    providerTransactionId: { type: String, default: null, index: true },
    // created: charged, not yet with the provider. started: the signer is with the provider.
    // applying: confirmed, and the signature is being put on the document.
    status: { type: String, enum: ["created", "started", "applying", "signed", "failed"], default: "created" },
    // Hash of the document as it stood when the signer agreed to sign it
    documentHash: { type: String, required: true },
    // The signer's filled fields, kept only until the signature is applied
    fields: { type: Array, default: [] },
    consentVersion: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    // Whose wallet paid, and how much. Zero for test documents and where charging is off.
    billingUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chargedPaise: { type: Number, default: 0 },
    refunded: { type: Boolean, default: false },
    result: {
      signerName: { type: String, default: null },
      certificateSerial: { type: String, default: null },
      certificateIssuer: { type: String, default: null },
      signedAt: { type: Date, default: null },
      failureReason: { type: String, default: null },
    },
    // Used only by the stand-in provider outside production: what the person on its page chose
    standIn: {
      outcome: { type: String, enum: ["pending", "signed", "failed"], default: "pending" },
      name: { type: String, default: null },
    },
  },
  { timestamps: true }
);

export const EsignTransaction = mongoose.model("EsignTransaction", esignTransactionSchema);
