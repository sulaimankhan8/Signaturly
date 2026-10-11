import { EsignTransaction } from "../../../models/EsignTransaction.model.js";
import { env } from "../../../config/env.js";

/**
 * A stand-in for an Aadhaar eSign provider, for development and tests only.
 *
 * It is not Aadhaar eSign and nothing it produces has legal effect. Instead of the provider's
 * page, the signer sees a page of this app that says so and offers "approve" and "fail".
 * It can never be selected in production (see providerFor in esign.service.js).
 *
 * A real provider implements the same four functions:
 *
 *   start({ reference, documentHash, documentName, signerName, returnUrl })
 *       -> { transactionId, redirectUrl }      the signer is sent to redirectUrl
 *   result(transactionId)
 *       -> { status: "pending" | "signed" | "failed", signerName, certificateSerial,
 *            certificateIssuer, signedAt, failureReason }
 *   verifyCallback(req)
 *       -> { transactionId } when the request is a genuine notice from the provider, else null
 *   name
 */
export const fakeProvider = {
  name: "fake",

  async start({ reference, returnUrl }) {
    const transactionId = `standin_${reference}`;
    return {
      transactionId,
      redirectUrl: `${env.appUrl}/esign-stand-in/${reference}?return=${encodeURIComponent(returnUrl)}`,
    };
  },

  async result(transactionId) {
    const transaction = await EsignTransaction.findOne({ providerTransactionId: transactionId, provider: "fake" }).lean();
    const outcome = transaction?.standIn?.outcome || "pending";
    if (outcome === "signed") {
      return {
        status: "signed",
        signerName: transaction.standIn.name,
        certificateSerial: `STANDIN-${String(transaction._id).slice(-8).toUpperCase()}`,
        certificateIssuer: "Stand-in provider (not a licensed certifying authority)",
        signedAt: transaction.updatedAt,
      };
    }
    if (outcome === "failed") return { status: "failed", failureReason: "The signer did not complete Aadhaar eSign" };
    return { status: "pending" };
  },

  // The stand-in never calls back; its page tells this service directly
  async verifyCallback() {
    return null;
  },
};
