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

export const sendEmail = async ({ to, subject, html, text }) => {
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${env.appName}" <${env.smtpFrom || env.smtpUser}>`,
        to,
        subject,
        html,
        text: text || subject,
      });
      console.log("📧 [Email Sent via Gmail]:", { to, messageId: info.messageId });
      return info;
    } catch (err) {
      console.error("❌ [Email Error]:", err.message);
      // Fallback log to console if network error occurs
      console.log(`[Email Fallback Info]: URL for ${to} dispatched.`);
    }
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
