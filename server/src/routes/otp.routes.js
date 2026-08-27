import express from "express";
import { Recipient } from "../models/Recipient.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { generateAndSendOtp, verifyOtp } from "../services/otp.service.js";

const router = express.Router();

// POST /api/sign/otp/send - Request a new 6-digit OTP code for a signing session
router.post("/send", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Signing token is required" });
    }

    const recipient = await Recipient.findOne({ token });
    if (!recipient) {
      return res.status(404).json({ error: "Signer recipient record not found" });
    }

    const pdf = await Pdf.findById(recipient.pdfId);
    const pdfTitle = pdf?.originalFileName || "Document";

    const result = await generateAndSendOtp(recipient._id, recipient.email, pdfTitle);
    return res.json({ message: "Verification code dispatched", expiresAt: result.expiresAt });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ error: "Failed to send verification code" });
  }
});

// POST /api/sign/otp/verify - Verify 6-digit OTP code
router.post("/verify", async (req, res) => {
  try {
    const { token, otp } = req.body;
    if (!token || !otp) {
      return res.status(400).json({ error: "Token and OTP code are required" });
    }

    const recipient = await Recipient.findOne({ token });
    if (!recipient) {
      return res.status(404).json({ error: "Signer recipient record not found" });
    }

    const result = await verifyOtp(recipient._id, otp);
    if (!result.success) {
      return res.status(400).json({ error: result.reason });
    }

    return res.json({ success: true, message: "Identity verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({ error: "Failed to verify identity code" });
  }
});

export default router;
