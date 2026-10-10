import crypto from "crypto";
import bcrypt from "bcrypt";
import { RecipientOtp } from "../models/RecipientOtp.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { sendOtpEmail } from "./email.service.js";
import { sendMessage } from "./messaging/index.js";

export const OTP_RESEND_WAIT_MS = 60 * 1000;
export const OTP_MAX_SENDS_PER_HOUR = 5;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

/**
 * Generates a 6-digit OTP, saves the hash, and dispatches an email to the recipient.
 * Enforces a wait between sends and an hourly cap per signer.
 */
export async function generateAndSendOtp(recipientId, email, pdfTitle = "Document") {
  const recipient = await Recipient.findById(recipientId);
  if (!recipient) {
    return { success: false, status: 404, reason: "Signer recipient record not found" };
  }

  const now = Date.now();

  if (recipient.otpLastSentAt && now - recipient.otpLastSentAt.getTime() < OTP_RESEND_WAIT_MS) {
    const waitSeconds = Math.ceil((OTP_RESEND_WAIT_MS - (now - recipient.otpLastSentAt.getTime())) / 1000);
    return { success: false, status: 429, reason: `Please wait ${waitSeconds} seconds before requesting another code.` };
  }

  const windowActive = recipient.otpWindowStart && now - recipient.otpWindowStart.getTime() < OTP_WINDOW_MS;
  if (windowActive && recipient.otpSendCount >= OTP_MAX_SENDS_PER_HOUR) {
    return { success: false, status: 429, reason: "Too many codes requested. Please try again in an hour." };
  }

  // Cryptographically secure 6-digit code
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpHash = await bcrypt.hash(otpCode, 10);
  const expiresAt = new Date(now + OTP_TTL_MS);

  await RecipientOtp.deleteMany({ recipientId });
  await RecipientOtp.create({
    recipientId,
    email: email || recipient.phone,
    otpHash,
    expiresAt,
    verified: false,
    attempts: 0,
  });

  recipient.otpLastSentAt = new Date(now);
  if (windowActive) {
    recipient.otpSendCount += 1;
  } else {
    recipient.otpWindowStart = new Date(now);
    recipient.otpSendCount = 1;
  }
  await recipient.save();

  // The code goes wherever the signing link went
  const viaMessage = recipient.channel !== "email" && recipient.phone;
  if (viaMessage) {
    await sendMessage({
      channel: recipient.channel,
      to: recipient.phone,
      template: "otp",
      params: { code: otpCode, document: pdfTitle },
      language: recipient.language,
    });
  } else {
    await sendOtpEmail({ email, otp: otpCode, pdfTitle, language: recipient.language });
  }

  return { success: true, expiresAt, method: viaMessage ? "sms_otp" : "email_otp" };
}

/**
 * Verifies the 6-digit OTP submitted by recipient. Each code can be used once.
 */
export async function verifyOtp(recipientId, submittedOtp) {
  const otpRecord = await RecipientOtp.findOne({ recipientId });

  if (!otpRecord || otpRecord.verified) {
    return { success: false, reason: "No active verification code found. Please request a new one." };
  }

  if (new Date() > otpRecord.expiresAt) {
    await RecipientOtp.deleteOne({ _id: otpRecord._id });
    return { success: false, reason: "Verification code has expired. Please request a new one." };
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await RecipientOtp.deleteOne({ _id: otpRecord._id });
    return { success: false, reason: "Too many failed attempts. Please request a new code." };
  }

  const isMatch = await bcrypt.compare(String(submittedOtp), otpRecord.otpHash);

  if (!isMatch) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return { success: false, reason: `Invalid code. ${OTP_MAX_ATTEMPTS - otpRecord.attempts} attempts remaining.` };
  }

  await RecipientOtp.deleteOne({ _id: otpRecord._id });

  return { success: true };
}
