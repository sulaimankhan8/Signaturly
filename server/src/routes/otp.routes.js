import express from "express";
import bcrypt from "bcrypt";
import { Recipient } from "../models/Recipient.model.js";
import { generateAndSendOtp, verifyOtp } from "../services/otp.service.js";
import { getRecipientByToken } from "../services/recipient.service.js";
import { validate, schemas } from "../middlewares/validate.middleware.js";
import { otpSendLimiter, otpVerifyLimiter } from "../middlewares/rateLimit.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { appendAuditEvent } from "../services/auditLedger.service.js";

const router = express.Router();

const PASSCODE_MAX_ATTEMPTS = 5;
const PASSCODE_LOCK_MS = 15 * 60 * 1000;

// Loads the signer for a link, applying expiry, void and decline rules. Errors keep the { error } shape the client reads.
const loadRecipient = async (token, res) => {
  try {
    return await getRecipientByToken(token);
  } catch (err) {
    res.status(err.statusCode || 404).json({ error: err.message });
    return null;
  }
};

const METHOD_LABELS = {
  email_otp: "a one-time code sent by email",
  sms_otp: "a one-time code sent to their phone",
  passcode: "the access passcode set by the sender",
};

const markVerified = async (recipient, method, req) => {
  recipient.authVerified = true;
  recipient.authMethod = method;
  recipient.authVerifiedAt = new Date();
  recipient.passcodeAttempts = 0;
  recipient.passcodeLockedUntil = undefined;
  await recipient.save();

  await appendAuditEvent({
    pdfId: recipient.pdfId?._id || recipient.pdfId,
    recipientId: recipient._id,
    event: "identity_verified",
    actorName: recipient.name,
    actorEmail: recipient.email,
    description: `${recipient.name} passed the identity check using ${METHOD_LABELS[method]}.`,
    authMethod: method,
    otpVerified: method === "email_otp" || method === "sms_otp",
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });
};

// POST /api/sign/otp/send - Request a new 6-digit OTP code for a signing session
router.post("/send", otpSendLimiter, validate({ body: schemas.otpSend }), asyncHandler(async (req, res) => {
  const loaded = await loadRecipient(req.body.token, res);
  if (!loaded) return;
  const { recipient, pdf } = loaded;

  if (recipient.authType !== "otp") {
    return res.status(400).json({ error: "This signing link does not use email verification codes" });
  }

  let result;
  try {
    result = await generateAndSendOtp(recipient._id, recipient.email, pdf.originalFileName || "Document");
  } catch (error) {
    console.error("Error sending OTP:", error.message);
    return res.status(502).json({ error: "Failed to send verification code" });
  }

  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.reason });
  }
  return res.json({ message: "Verification code dispatched", expiresAt: result.expiresAt });
}));

// POST /api/sign/otp/verify - Verify 6-digit OTP code
router.post("/verify", otpVerifyLimiter, validate({ body: schemas.otpVerify }), asyncHandler(async (req, res) => {
  const loaded = await loadRecipient(req.body.token, res);
  if (!loaded) return;
  const { recipient } = loaded;

  if (recipient.authType !== "otp") {
    return res.status(400).json({ error: "This signing link does not use email verification codes" });
  }

  const result = await verifyOtp(recipient._id, req.body.otp);
  if (!result.success) {
    return res.status(400).json({ error: result.reason });
  }

  await markVerified(recipient, recipient.channel !== "email" && recipient.phone ? "sms_otp" : "email_otp", req);
  return res.json({ success: true, message: "Identity verified successfully" });
}));

// POST /api/sign/otp/verify-passcode - Verify sender-set passcode
router.post("/verify-passcode", otpVerifyLimiter, validate({ body: schemas.passcodeVerify }), asyncHandler(async (req, res) => {
  const loaded = await loadRecipient(req.body.token, res);
  if (!loaded) return;
  const { recipient } = loaded;

  // Only passcode signers may use this route; nobody is verified by default
  if (recipient.authType !== "passcode" || !recipient.passcodeHash) {
    return res.status(400).json({ error: "This signing link does not use an access passcode" });
  }

  if (recipient.passcodeLockedUntil && recipient.passcodeLockedUntil > new Date()) {
    return res.status(429).json({ error: "Too many wrong passcodes. Please try again in 15 minutes." });
  }

  const isMatch = await bcrypt.compare(req.body.passcode, recipient.passcodeHash);
  if (!isMatch) {
    const updated = await Recipient.findByIdAndUpdate(
      recipient._id,
      { $inc: { passcodeAttempts: 1 } },
      { new: true }
    );
    if (updated.passcodeAttempts >= PASSCODE_MAX_ATTEMPTS) {
      updated.passcodeAttempts = 0;
      updated.passcodeLockedUntil = new Date(Date.now() + PASSCODE_LOCK_MS);
      await updated.save();
      return res.status(429).json({ error: "Too many wrong passcodes. Please try again in 15 minutes." });
    }
    return res.status(400).json({ error: "Invalid access passcode. Please check with the document sender." });
  }

  await markVerified(recipient, "passcode", req);
  return res.json({ success: true, message: "Passcode verified successfully" });
}));

export default router;
