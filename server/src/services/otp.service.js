import crypto from "crypto";
import bcrypt from "bcryptjs";
import { RecipientOtp } from "../models/RecipientOtp.model.js";
import { sendOtpEmail } from "./email.service.js";

/**
 * Generates a 6-digit OTP, saves the hash, and dispatches an email to the recipient.
 */
export async function generateAndSendOtp(recipientId, email, pdfTitle = "Document") {
  // 1. Generate random 6-digit number
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(otpCode, salt);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // 2. Remove existing pending OTPs for this recipient
  await RecipientOtp.deleteMany({ recipientId });

  // 3. Create new OTP record
  await RecipientOtp.create({
    recipientId,
    email,
    otpHash,
    expiresAt,
    verified: false,
    attempts: 0,
  });

  // 4. Send email
  await sendOtpEmail({ email, otp: otpCode, pdfTitle });

  return { success: true, expiresAt };
}

/**
 * Verifies the 6-digit OTP submitted by recipient.
 */
export async function verifyOtp(recipientId, submittedOtp) {
  const otpRecord = await RecipientOtp.findOne({ recipientId });

  if (!otpRecord) {
    return { success: false, reason: "No active verification code found. Please request a new one." };
  }

  if (otpRecord.verified) {
    return { success: true, message: "Already verified" };
  }

  if (new Date() > otpRecord.expiresAt) {
    await RecipientOtp.deleteOne({ _id: otpRecord._id });
    return { success: false, reason: "Verification code has expired. Please request a new one." };
  }

  if (otpRecord.attempts >= 5) {
    await RecipientOtp.deleteOne({ _id: otpRecord._id });
    return { success: false, reason: "Too many failed attempts. Please request a new code." };
  }

  const isMatch = await bcrypt.compare(submittedOtp, otpRecord.otpHash);

  if (!isMatch) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return { success: false, reason: `Invalid code. ${5 - otpRecord.attempts} attempts remaining.` };
  }

  otpRecord.verified = true;
  await otpRecord.save();

  return { success: true };
}
