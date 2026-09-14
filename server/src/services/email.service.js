import { sendEmail } from "../config/email.js";
import { env } from "../config/env.js";

const emailWrapper = (content, headerTitle = "Signaturly Pro") => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #334155; margin: 0; padding: 24px 12px; -webkit-font-smoothing: antialiased; }
    .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); overflow: hidden; }
    .header { background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 2px solid #ef4444; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .badge { display: inline-block; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 4px; }
    .body-content { padding: 32px 24px; }
    .btn { display: inline-block; background-color: #dc2626; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; text-align: center; margin: 16px 0; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.25); }
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .footer { text-align: center; padding: 18px 24px; color: #64748b; font-size: 12px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; line-height: 1.5; }
    .highlight { color: #dc2626; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Signaturly<span style="color:#ef4444;">Pro</span></h1>
      <span class="badge">Legal E-Signature System</span>
    </div>
    <div class="body-content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin:0 0 4px 0;">Securely powered by <strong>Signaturly Pro</strong> Cryptographic Vault.</p>
      <p style="margin:0;">This is a confidential legal document request. Please do not forward.</p>
    </div>
  </div>
</body>
</html>
`;

export const sendSigningRequestEmail = async ({ recipient, pdf, sender, customMessage }) => {
  const signingUrl = `${env.appUrl}/sign/${recipient.token}`;
  
  const content = `
    <h2 style="color:#0f172a; margin-top:0; font-size:18px; font-weight:700;">Signature Requested</h2>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      <strong style="color:#0f172a;">${sender.name || sender.email}</strong> has sent you a document to review and electronically sign.
    </p>

    <div class="card">
      <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Document Title</div>
      <div style="font-size:15px; color:#0f172a; font-weight:600; margin-top:4px;">${pdf.originalFileName}</div>
      <div style="font-size:12px; color:#64748b; margin-top:4px;">Total Pages: ${pdf.pageCount}</div>
      ${customMessage ? `<div style="margin-top:12px; padding-top:12px; border-top:1px solid #e2e8f0; font-style:italic; color:#334155; font-size:13px;">"${customMessage}"</div>` : ""}
    </div>

    <div style="text-align:center; margin:24px 0;">
      <a href="${signingUrl}" class="btn">Review &amp; Sign Document</a>
    </div>

    <p style="font-size:12px; color:#64748b; margin-top:20px; text-align:center; word-break:break-all;">
      If the button above does not work, copy and paste this link in your browser:<br>
      <a href="${signingUrl}" style="color:#dc2626; text-decoration:underline;">${signingUrl}</a>
    </p>
  `;

  return sendEmail({
    to: recipient.email,
    subject: `Signature Requested: "${pdf.originalFileName}" from ${sender.name || sender.email}`,
    html: emailWrapper(content, "Signature Request"),
    text: `Signature Requested: "${pdf.originalFileName}". Please sign here: ${signingUrl}`,
  });
};

export const sendCompletionEmail = async ({ recipientEmail, recipientName, pdf, senderName, downloadUrl }) => {
  const fileUrl = `${env.appUrl}${downloadUrl}`;
  const content = `
    <h2 style="color:#059669; margin-top:0; font-size:18px; font-weight:700;">✓ Document Executed &amp; Completed</h2>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      All parties have completed and signed <strong style="color:#0f172a;">${pdf.originalFileName}</strong>.
    </p>

    <div class="card">
      <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Document Title</div>
      <div style="font-size:15px; color:#0f172a; font-weight:600; margin-top:4px;">${pdf.originalFileName}</div>
      <div style="font-size:12px; color:#059669; font-weight:600; margin-top:4px;">Status: Legally Executed (SHA-256 Ledger Verified)</div>
    </div>

    <div style="text-align:center; margin:24px 0;">
      <a href="${fileUrl}" class="btn" style="background-color:#059669;">Download Signed PDF</a>
    </div>

    <p style="font-size:12px; color:#64748b; text-align:center;">
      A permanent cryptographic audit certificate has been attached to the executed agreement.
    </p>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `Completed & Signed: "${pdf.originalFileName}"`,
    html: emailWrapper(content, "Document Executed"),
    text: `All parties have completed signing "${pdf.originalFileName}". Download here: ${fileUrl}`,
  });
};

export const sendDeclineEmail = async ({ senderEmail, pdf, declinedRecipient, reason }) => {
  const content = `
    <h2 style="color:#dc2626; margin-top:0; font-size:18px; font-weight:700;">Document Signing Declined</h2>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      <strong class="highlight">${declinedRecipient.name} (${declinedRecipient.email})</strong> has declined to sign <strong style="color:#0f172a;">${pdf.originalFileName}</strong>.
    </p>

    <div class="card" style="border-left: 3px solid #dc2626;">
      <div style="font-size:11px; color:#dc2626; text-transform:uppercase; font-weight:700;">Reason Provided</div>
      <div style="font-size:14px; color:#0f172a; margin-top:4px;">${reason || "No specific reason provided."}</div>
    </div>
  `;

  return sendEmail({
    to: senderEmail,
    subject: `Declined: "${pdf.originalFileName}" by ${declinedRecipient.name}`,
    html: emailWrapper(content, "Document Declined"),
    text: `${declinedRecipient.name} declined to sign "${pdf.originalFileName}". Reason: ${reason}`,
  });
};

export const sendCancellationNotificationEmail = async ({ recipientEmail, recipientName, pdf, eventType = "voided", reason = "" }) => {
  const isVoided = eventType === "voided";
  const title = isVoided ? "Document Cancelled / Voided" : "Document Cancelled (Declined by Signer)";
  const description = isVoided
    ? `The document <strong>${pdf.originalFileName}</strong> has been cancelled and voided by the sender.`
    : `The document <strong>${pdf.originalFileName}</strong> has been cancelled because another party declined to sign.`;

  const content = `
    <h2 style="color:#dc2626; margin-top:0; font-size:18px; font-weight:700;">${title}</h2>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:12px;">
      Hello ${recipientName || "Signer"},
    </p>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      ${description} Any pending or prior signatures on this document are now void and non-binding.
    </p>

    <div class="card" style="border-left: 3px solid #dc2626;">
      <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Document Status</div>
      <div style="font-size:14px; color:#0f172a; font-weight:600; margin-top:4px;">${pdf.originalFileName} &mdash; <span style="color:#dc2626;">VOID / CANCELLED</span></div>
      ${reason ? `<div style="font-size:13px; color:#64748b; margin-top:6px;"><em>Reason: ${reason}</em></div>` : ""}
    </div>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `Document Cancelled: "${pdf.originalFileName}"`,
    html: emailWrapper(content, "Document Cancelled"),
    text: `Notice: "${pdf.originalFileName}" has been cancelled. Any prior signatures are void. Reason: ${reason || "N/A"}`,
  });
};

export const sendPasswordResetEmail = async ({ email, name, resetToken }) => {
  const resetUrl = `${env.appUrl}/reset-password?token=${resetToken}`;
  
  const content = `
    <h2 style="color:#0f172a; margin-top:0; font-size:18px; font-weight:700;">Password Reset Request</h2>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      Hello <strong style="color:#0f172a;">${name || email}</strong>, we received a request to reset your Signaturly Pro password.
    </p>

    <div style="text-align:center; margin:24px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>

    <p style="font-size:12px; color:#64748b; line-height:1.5;">
      This password reset link is valid for <strong>1 hour</strong>. If you did not request this, you can safely ignore this email.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: "Reset your Signaturly Pro password",
    html: emailWrapper(content, "Password Reset"),
    text: `Reset your Signaturly Pro password: ${resetUrl} (Valid for 1 hour)`,
  });
};

export const sendReminderEmail = async ({ recipient, pdf, sender, customMessage }) => {
  const signingUrl = `${env.appUrl}/sign/${recipient.token}`;

  const content = `
    <h2 style="color:#0f172a; margin-top:0; font-size:18px; font-weight:700;">Friendly Reminder: Signature Pending</h2>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      This is a reminder that <strong style="color:#0f172a;">${sender.name || sender.email}</strong> is awaiting your review and electronic signature on <strong style="color:#0f172a;">${pdf.originalFileName}</strong>.
    </p>

    <div class="card">
      <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Document Title</div>
      <div style="font-size:15px; color:#0f172a; font-weight:600; margin-top:4px;">${pdf.originalFileName}</div>
      ${pdf.expiresAt ? `<div style="font-size:12px; color:#d97706; margin-top:4px;">⚠️ Deadline: ${new Date(pdf.expiresAt).toLocaleDateString()}</div>` : ""}
      ${customMessage ? `<div style="margin-top:12px; padding-top:12px; border-top:1px solid #e2e8f0; font-style:italic; color:#334155; font-size:13px;">"${customMessage}"</div>` : ""}
    </div>

    <div style="text-align:center; margin:24px 0;">
      <a href="${signingUrl}" class="btn">Review &amp; Sign Now</a>
    </div>
  `;

  return sendEmail({
    to: recipient.email,
    subject: `Reminder: Please sign "${pdf.originalFileName}" from ${sender.name || sender.email}`,
    html: emailWrapper(content, "Signature Reminder"),
    text: `Reminder: Please sign "${pdf.originalFileName}". Link: ${signingUrl}`,
  });
};

export const sendOtpEmail = async ({ email, otp, pdfTitle = "Document" }) => {
  const content = `
    <h2 style="color:#0f172a; margin-top:0; font-size:18px; font-weight:700;">Identity Verification Code</h2>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      You are accessing and signing <strong style="color:#0f172a;">${pdfTitle}</strong>. Use the 6-digit verification code below:
    </p>

    <div class="card" style="text-align:center; padding:24px; background-color:#f8fafc;">
      <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; letter-spacing:1px;">Security Verification Code</div>
      <div style="font-size:36px; color:#0f172a; font-weight:800; letter-spacing:8px; margin-top:8px; font-family:monospace;">${otp}</div>
      <div style="font-size:12px; color:#64748b; margin-top:8px;">Valid for 10 minutes. Do not share this code.</div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `[${otp}] Your Identity Verification Code for "${pdfTitle}"`,
    html: emailWrapper(content, "Pre-Sign Authentication"),
    text: `Your Signaturly Pro identity verification code for "${pdfTitle}" is: ${otp} (Valid for 10 minutes).`,
  });
};
