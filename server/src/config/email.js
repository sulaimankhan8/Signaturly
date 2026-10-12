import nodemailer from "nodemailer";
import { env } from "./env.js";

let transporter = null;

if (env.smtpUser && env.smtpPass) {
  const cleanPass = env.smtpPass.replace(/\s+/g, "");
  
  if (env.smtpHost?.includes("gmail") || env.smtpUser?.includes("@gmail.com")) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.smtpUser,
        pass: cleanPass,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      host: env.smtpHost || "smtp.gmail.com",
      port: env.smtpPort || 465,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: cleanPass,
      },
    });
  }
}

// In tests every message lands here so codes and links can be read back
export const emailOutbox = [];

// `replyTo` is who an answer should go to, when that is not the sender
export const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  if (env.isTest) {
    emailOutbox.push({ to, subject, html, text, ...(replyTo ? { replyTo } : {}) });
    return { test: true, to, subject };
  }

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${env.appName}" <${env.smtpFrom || env.smtpUser}>`,
        to,
        subject,
        html,
        text: text || subject,
        ...(replyTo ? { replyTo } : {}),
      });
      console.log("📧 [Email Sent]:", { messageId: info.messageId });
      return info;
    } catch (err) {
      console.error("❌ [Email Error]:", err.message);
      // Surface the failure so callers and job retries can react
      throw err;
    }
  } else if (env.isProd) {
    // Never print message contents (codes, links) to production logs
    throw new Error("Email is not configured: set SMTP_USER and SMTP_PASS");
  } else {
    console.log("\n==================== 📧 MOCK EMAIL NOTIFICATION ====================");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("------------------------------------------------------------------");
    console.log(text || "HTML Content Dispatched");
    console.log("====================================================================\n");
    return { mock: true, to, subject };
  }
};
