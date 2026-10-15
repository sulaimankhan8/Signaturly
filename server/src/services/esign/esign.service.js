import mongoose from "mongoose";
import { EsignTransaction } from "../../models/EsignTransaction.model.js";
import { Recipient } from "../../models/Recipient.model.js";
import { Pdf } from "../../models/Pdf.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import { USAGE_PRICES_PAISE } from "../../config/plans.js";
import { getRecipientByToken, assertRecipientVerified, submitRecipientSignature, CONSENT_VERSION } from "../recipient.service.js";
import { assertRecordAccess } from "../authorize.service.js";
import { billingUserIdOf } from "../branding.service.js";
import { debitWallet, creditWallet, getWallet } from "../wallet.service.js";
import { currentKeyOf } from "../documentFiles.service.js";
import { readFile } from "../storage.service.js";
import { sha256FromBuffer } from "../hash.service.js";
import { appendAuditEvent } from "../auditLedger.service.js";
import { fakeProvider } from "./providers/fake.provider.js";
import { mergeSignerFields } from "../fieldRules.service.js";

/**
 * Aadhaar eSign (plan tasks P6-02 to P6-06).
 *
 * What is here: the provider interface with a stand-in provider, the signer's flow (agree,
 * go to the provider, come back, signature applied), charging the wallet and refunding a
 * failed attempt, the rule that Aadhaar signers sign last, and the way back to ordinary signing.
 *
 * What is not here yet: no licensed provider is connected (task P6-01 is choosing one), and the
 * provider's own digital signature is not placed inside the PDF. Until both are done this is
 * NOT Aadhaar eSign and must not be offered as such: production keeps it switched off.
 */

// Providers by name. A licensed provider is added here once one is chosen.
const PROVIDERS = { fake: fakeProvider };

/**
 * The provider in use, or null when Aadhaar eSign is switched off.
 * The stand-in can never be used in production, whatever the configuration says.
 */
export const esignProvider = () => {
  const provider = PROVIDERS[env.esignProvider] || null;
  if (provider?.name === "fake" && env.isProd) return null;
  return provider;
};

export const esignAvailable = () => Boolean(esignProvider());

const pricePaise = () => USAGE_PRICES_PAISE.aadhaarEsign;
const charges = (pdf) => env.usageChargingEnabled && !pdf.testMode;
const isId = (value) => mongoose.isValidObjectId(String(value || ""));

/**
 * Plan task P6-04: where a document has Aadhaar signers, they sign after everyone else, one
 * at a time. Everyone else's marks are on the page before the first Aadhaar signature is made,
 * so no later change to the file can disturb an Aadhaar signature already on it.
 *
 * Returns the recipients in the order they will sign, and how many use Aadhaar.
 * Refuses when Aadhaar eSign is unavailable or the wallet cannot pay for every signature.
 */
export const prepareAadhaarSigners = async ({ pdf, recipientsData }) => {
  const list = Array.isArray(recipientsData) ? recipientsData : [];
  const usesAadhaar = (r) => r && r.signatureType === "aadhaar" && (r.role || "signer") === "signer";
  const count = list.filter(usesAadhaar).length;
  if (count === 0) return { recipientsData, count: 0 };

  if (!esignAvailable()) {
    throw new ApiError(503, "ESIGN_UNAVAILABLE: Aadhaar eSign is not available yet. Choose ordinary signing for these signers.");
  }

  if (charges(pdf)) {
    const wallet = await getWallet(await billingUserIdOf(pdf), { limit: 1 });
    const needed = count * pricePaise();
    if (wallet.balancePaise < needed) {
      throw new ApiError(
        402,
        `WALLET_INSUFFICIENT: ${count} Aadhaar eSign signature${count === 1 ? "" : "s"} cost Rs. ${(needed / 100).toFixed(2)}. Add credit to the wallet and send again.`
      );
    }
  }

  const byOrder = (a, b) => (Number(a.signingOrder) || 0) - (Number(b.signingOrder) || 0);
  const ordered = [...list.filter((r) => !usesAadhaar(r)).sort(byOrder), ...list.filter(usesAadhaar).sort(byOrder)];
  return { recipientsData: ordered.map((r, index) => ({ ...r, signingOrder: index + 1 })), count };
};

/**
 * What the signing page needs to know about how this signer signs.
 */
export const esignStateFor = async (recipient) => {
  if (recipient.signatureType !== "aadhaar") return { required: false };
  return {
    required: true,
    available: esignAvailable(),
    status: recipient.esign?.status || "none",
    // Shown on the page so nobody mistakes the stand-in for the real thing
    standIn: esignProvider()?.name === "fake",
  };
};

const audit = (pdf, recipient, event, description, { ipAddress = "", userAgent = "" } = {}) =>
  appendAuditEvent({
    pdfId: pdf._id,
    recipientId: recipient._id,
    event,
    actorName: recipient.name,
    actorEmail: recipient.email,
    ipAddress,
    userAgent,
    description,
  });

const refund = async (transaction, reason) => {
  if (!transaction.chargedPaise || transaction.refunded) return;
  // The reference makes the refund happen once, however often this is reached
  await creditWallet(transaction.billingUserId, transaction.chargedPaise, {
    reference: `esign-refund:${transaction._id}`,
    reason: "Aadhaar eSign not completed, refunded",
    meta: { reason },
  });
  await EsignTransaction.updateOne({ _id: transaction._id }, { $set: { refunded: true } });
};

const fail = async (transaction, recipient, pdf, reason, context) => {
  await EsignTransaction.updateOne({ _id: transaction._id }, { $set: { status: "failed", "result.failureReason": String(reason).slice(0, 300), fields: [] } });
  await refund(transaction, reason);
  await Recipient.updateOne({ _id: recipient._id }, { $set: { "esign.status": "failed", "esign.lastError": String(reason).slice(0, 300) } });
  await audit(pdf, recipient, "esign_failed", `Aadhaar eSign was not completed: ${String(reason).slice(0, 200)}`, context);
};

// Names on certificates differ in order, spacing and initials from what a sender types.
// This records whether they plainly agree; it never blocks a signature by itself.
const sameName = (a, b) => {
  const words = (value) => String(value || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 1).sort();
  const [x, y] = [words(a), words(b)];
  if (x.length === 0 || y.length === 0) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((word) => long.includes(word));
};

/**
 * The signer has filled in their fields and agreed. Charges the wallet, keeps what they
 * filled in, and returns the provider's address to send them to.
 */
export const startEsign = async ({ token, filledFields, consent, consentVersion, ipAddress = "", userAgent = "" }) => {
  if (consent !== true) throw new ApiError(422, "You must agree to sign electronically before continuing");

  const { recipient, pdf } = await getRecipientByToken(token);
  assertRecipientVerified(recipient);
  if (recipient.signatureType !== "aadhaar") throw new ApiError(400, "This document is not signed with Aadhaar eSign");
  if (recipient.status === "signed") throw new ApiError(409, "You have already signed this document");
  if (!["sent", "viewed"].includes(recipient.status) || !["pending", "partially_signed"].includes(pdf.status)) {
    throw new ApiError(409, "This document is not waiting for your signature yet");
  }

  // Checked now, before the wallet is charged and the signer leaves for the provider
  mergeSignerFields({ fields: pdf.fields, submitted: filledFields, recipient });

  const provider = esignProvider();
  if (!provider) throw new ApiError(503, "ESIGN_UNAVAILABLE: Aadhaar eSign is not available right now. Ask the sender to switch you to ordinary signing.");

  const documentHash = sha256FromBuffer(await readFile(await currentKeyOf(pdf)));
  const billingUserId = await billingUserIdOf(pdf);

  const transaction = await EsignTransaction.create({
    pdfId: pdf._id,
    recipientId: recipient._id,
    provider: provider.name,
    documentHash,
    fields: (Array.isArray(filledFields) ? filledFields : []).slice(0, 500),
    consentVersion: consentVersion || CONSENT_VERSION,
    ipAddress,
    userAgent,
    billingUserId,
  });
  const context = { ipAddress, userAgent };

  if (charges(pdf)) {
    try {
      await debitWallet(billingUserId, pricePaise(), { reference: `esign:${transaction._id}`, reason: "Aadhaar eSign signature", meta: { pdfId: pdf._id.toString() } });
      transaction.chargedPaise = pricePaise();
      await transaction.save();
    } catch (err) {
      await fail(transaction, recipient, pdf, "The sender's wallet could not pay for the signature", context);
      // The signer cannot fix this; tell them who can
      throw new ApiError(402, "ESIGN_UNPAID: Aadhaar eSign could not be started. Please ask the sender to add credit and try again.");
    }
  }

  let started;
  try {
    started = await provider.start({
      reference: transaction._id.toString(),
      documentHash,
      documentName: pdf.originalFileName,
      signerName: recipient.name,
      returnUrl: `${env.appUrl}/sign/${recipient.token}?esign=${transaction._id}`,
    });
  } catch (err) {
    await fail(transaction, recipient, pdf, `The provider could not start: ${err.message}`, context);
    throw new ApiError(502, "Aadhaar eSign could not be started. Please try again in a few minutes.");
  }

  transaction.providerTransactionId = started.transactionId;
  transaction.status = "started";
  await transaction.save();

  await Recipient.updateOne(
    { _id: recipient._id },
    { $set: { "esign.status": "started", "esign.provider": provider.name, "esign.transactionId": transaction._id.toString(), "esign.lastError": null } }
  );
  await audit(pdf, recipient, "esign_started", `Sent to ${provider.name === "fake" ? "the stand-in provider" : provider.name} for Aadhaar eSign`, context);

  return { transactionId: transaction._id, redirectUrl: started.redirectUrl };
};

/**
 * The signer is back from the provider. Asks the provider what happened; if it signed, puts
 * the signature on the document. Safe to call more than once.
 */
export const completeEsign = async ({ token, transactionId, ipAddress = "", userAgent = "" }) => {
  const { recipient, pdf } = await getRecipientByToken(token);
  const transaction = isId(transactionId) ? await EsignTransaction.findOne({ _id: String(transactionId), recipientId: recipient._id }) : null;
  if (!transaction) throw new ApiError(404, "That Aadhaar eSign attempt was not found");
  return finishTransaction({ transaction, recipient, pdf, context: { ipAddress: ipAddress || transaction.ipAddress, userAgent: userAgent || transaction.userAgent } });
};

const finishTransaction = async ({ transaction, recipient, pdf, context }) => {
  if (transaction.status === "signed") return { success: true, alreadyDone: true };
  if (transaction.status === "failed") throw new ApiError(422, "ESIGN_FAILED: Aadhaar eSign was not completed. You can try again.");

  const provider = PROVIDERS[transaction.provider];
  if (!provider || (provider.name === "fake" && env.isProd)) throw new ApiError(503, "ESIGN_UNAVAILABLE: Aadhaar eSign is not available right now.");

  let outcome;
  try {
    outcome = await provider.result(transaction.providerTransactionId);
  } catch (err) {
    throw new ApiError(502, "The Aadhaar eSign provider could not be reached. Please try again in a moment.");
  }

  if (outcome.status === "pending") throw new ApiError(409, "ESIGN_PENDING: Aadhaar eSign has not finished yet.");
  if (outcome.status !== "signed") {
    await fail(transaction, recipient, pdf, outcome.failureReason || "Not completed", context);
    throw new ApiError(422, "ESIGN_FAILED: Aadhaar eSign was not completed. You can try again.");
  }

  // The document must still be the one the signer agreed to
  const hashNow = sha256FromBuffer(await readFile(await currentKeyOf(pdf)));
  if (hashNow !== transaction.documentHash) {
    await fail(transaction, recipient, pdf, "The document changed after the signer agreed to it", context);
    throw new ApiError(409, "The document changed while you were signing. Please open it and sign again.");
  }

  // Only one caller applies the signature: the signer's return and the provider's notice can arrive together
  const claimed = await EsignTransaction.findOneAndUpdate({ _id: transaction._id, status: "started" }, { $set: { status: "applying" } });
  if (!claimed) return { success: true, alreadyDone: true };

  let applied;
  try {
    applied = await submitRecipientSignature({
      token: recipient.token,
      filledFields: transaction.fields,
      consent: true,
      consentVersion: transaction.consentVersion,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch (err) {
    // The provider signed; only applying it failed. Leave it retryable and keep the charge.
    await EsignTransaction.updateOne({ _id: transaction._id }, { $set: { status: "started" } });
    throw err;
  }

  const nameMatches = sameName(outcome.signerName, recipient.name);
  await EsignTransaction.updateOne(
    { _id: transaction._id },
    {
      $set: {
        status: "signed",
        fields: [],
        "result.signerName": outcome.signerName || null,
        "result.certificateSerial": outcome.certificateSerial || null,
        "result.certificateIssuer": outcome.certificateIssuer || null,
        "result.signedAt": outcome.signedAt || new Date(),
      },
    }
  );
  await Recipient.updateOne(
    { _id: recipient._id },
    {
      $set: {
        "esign.status": "signed",
        "esign.signerName": outcome.signerName || null,
        "esign.nameMatches": nameMatches,
        "esign.certificateSerial": outcome.certificateSerial || null,
        "esign.certificateIssuer": outcome.certificateIssuer || null,
        "esign.completedAt": outcome.signedAt || new Date(),
      },
    }
  );
  await audit(
    pdf,
    recipient,
    "esign_verified",
    `Aadhaar eSign confirmed by ${transaction.provider === "fake" ? "the stand-in provider (no legal effect)" : transaction.provider}. ` +
      `Name on certificate: ${outcome.signerName || "not given"}${nameMatches ? "" : " (differs from the name the sender gave)"}. ` +
      `Certificate ${outcome.certificateSerial || "not given"}, issued by ${outcome.certificateIssuer || "not given"}.`,
    context
  );

  return { ...applied, nameMatches };
};

/**
 * A notice sent by the provider's own servers. It is believed only if the provider's code
 * confirms it is genuine, and even then the outcome is read back from the provider.
 */
export const handleProviderCallback = async (providerName, req) => {
  const provider = PROVIDERS[providerName];
  if (!provider || provider.name !== esignProvider()?.name) throw new ApiError(404, "Not found");

  const notice = await provider.verifyCallback(req);
  if (!notice?.transactionId) throw new ApiError(401, "The notice could not be verified");

  const transaction = await EsignTransaction.findOne({ providerTransactionId: String(notice.transactionId), provider: provider.name });
  if (!transaction || transaction.status !== "started") return { received: true };

  const recipient = await Recipient.findById(transaction.recipientId);
  const pdf = recipient && (await Pdf.findById(recipient.pdfId));
  if (!recipient || !pdf) return { received: true };

  try {
    await finishTransaction({ transaction, recipient, pdf, context: { ipAddress: transaction.ipAddress, userAgent: transaction.userAgent } });
  } catch (err) {
    // The signer's own return will try again; the provider only needs to know the notice arrived
    console.error("[eSign] Could not finish from the provider's notice:", err.message);
  }
  return { received: true };
};

/**
 * Development only: the stand-in provider's page reports what the person on it chose.
 */
export const reportStandInOutcome = async ({ transactionId, outcome, name }) => {
  if (env.isProd || esignProvider()?.name !== "fake") throw new ApiError(404, "Not found");
  if (!isId(transactionId) || !["signed", "failed"].includes(outcome)) throw new ApiError(400, "Invalid request");

  const transaction = await EsignTransaction.findOneAndUpdate(
    { _id: String(transactionId), provider: "fake", status: "started", "standIn.outcome": "pending" },
    { $set: { "standIn.outcome": outcome, "standIn.name": typeof name === "string" ? name.trim().slice(0, 120) : null } },
    { new: true }
  );
  if (!transaction) throw new ApiError(404, "That attempt was not found or has already been answered");
  return { outcome };
};

/**
 * Plan task P6-06: the way back. The sender switches a signer from Aadhaar eSign to ordinary
 * signing, for a signer whose Aadhaar is not linked to a phone or who cannot complete it.
 * Any attempt in progress is cancelled and refunded.
 */
export const switchToOrdinarySigning = async ({ recipientId, userId }) => {
  const recipient = isId(recipientId) ? await Recipient.findById(String(recipientId)) : null;
  const pdf = recipient && (await Pdf.findOne({ _id: recipient.pdfId, deletedAt: null }));
  if (!recipient || !pdf) throw new ApiError(404, "Signer not found");
  await assertRecordAccess(pdf, userId, "document.send");

  if (recipient.signatureType !== "aadhaar") return { signatureType: "electronic" };
  if (recipient.status === "signed") throw new ApiError(409, "This signer has already signed with Aadhaar eSign");

  const open = await EsignTransaction.find({ recipientId: recipient._id, status: { $in: ["created", "started"] } });
  for (const transaction of open) {
    await EsignTransaction.updateOne({ _id: transaction._id }, { $set: { status: "failed", "result.failureReason": "Switched to ordinary signing by the sender", fields: [] } });
    await refund(transaction, "Switched to ordinary signing");
  }

  await Recipient.updateOne({ _id: recipient._id }, { $set: { signatureType: "electronic", "esign.status": "none" } });
  await appendAuditEvent({
    pdfId: pdf._id,
    userId,
    recipientId: recipient._id,
    event: "recipient_updated",
    actorName: "Sender",
    description: `${recipient.name} was switched from Aadhaar eSign to ordinary signing`,
  });
  return { signatureType: "electronic" };
};
