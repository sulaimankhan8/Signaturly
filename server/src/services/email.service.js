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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #08090d; color: #e5e7eb; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #12141c; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #991b1b, #450a0a); padding: 30px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .badge { display: inline-block; background-color: rgba(0,0,0,0.4); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 6px; }
    .body-content { padding: 32px 24px; }
    .btn { display: inline-block; background: linear-gradient(to right, #dc2626, #991b1b); color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; text-align: center; margin-top: 20px; box-shadow: 0 4px 14px rgba(153,27,27,0.4); }
    .card { background-color: #08090d; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
    .highlight { color: #f87171; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Signaturly<span style="color:#ef4444;">Pro</span></h1>
      <span class="badge">E-Signature Platform</span>
    </div>
    <div class="body-content">
      ${content}
    </div>
    <div class="footer">
      <p>Securely powered by <strong>Signaturly Pro</strong> Cryptographic Vault.</p>
      <p>Please do not share your private signing link with others.</p>
    </div>
  </div>
</body>
</html>
`;

export const sendSigningRequestEmail = async ({ recipient, pdf, sender, customMessage }) => {
  const signingUrl = `${env.appUrl}/sign/${recipient.token}`;
  
  const content = `
    <h2 style="color:#ffffff; margin-top:0; font-size:20px;">Signature Requested</h2>
    <p style="color:#9ca3af; font-size:14px; line-height:1.6;">
      <strong style="color:#ffffff;">${sender.name || sender.email}</strong> has sent you a document to review and e-sign.
    </p>

    <div class="card">
      <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Document Name</div>
      <div style="font-size:15px; color:#ffffff; font-weight:600; margin-top:4px;">${pdf.originalFileName}</div>
      <div style="font-size:12px; color:#9ca3af; margin-top:4px;">Total Pages: ${pdf.pageCount}</div>
      ${customMessage ? `<div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); font-style:italic; color:#d1d5db; font-size:13px;">"${customMessage}"</div>` : ""}
    </div>

    <div style="text-align:center;">
      <a href="${signingUrl}" class="btn">Review & Sign Document</a>
    </div>

    <p style="font-size:12px; color:#6b7280; margin-top:24px; text-align:center;">
      Or copy and paste this link in your browser:<br>
      <a href="${signingUrl}" style="color:#ef4444; word-break:break-all;">${signingUrl}</a>
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
    <h2 style="color:#ffffff; margin-top:0; font-size:20px;">✓ Document Completed & Signed</h2>
    <p style="color:#9ca3af; font-size:14px; line-height:1.6;">
      All parties have completed and signed <strong style="color:#ffffff;">${pdf.originalFileName}</strong>.
    </p>

    <div class="card">
      <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Document Title</div>
      <div style="font-size:15px; color:#10b981; font-weight:600; margin-top:4px;">${pdf.originalFileName}</div>
      <div style="font-size:12px; color:#9ca3af; margin-top:4px;">Status: <span style="color:#34d399; font-weight:bold;">Legally Executed</span></div>
    </div>

    <div style="text-align:center;">
      <a href="${fileUrl}" class="btn" style="background: linear-gradient(to right, #059669, #047857);">Download Executed PDF</a>
    </div>
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
    <h2 style="color:#ffffff; margin-top:0; font-size:20px;">Document Signing Declined</h2>
    <p style="color:#9ca3af; font-size:14px; line-height:1.6;">
      <strong class="highlight">${declinedRecipient.name} (${declinedRecipient.email})</strong> has declined to sign <strong style="color:#ffffff;">${pdf.originalFileName}</strong>.
    </p>

    <div class="card" style="border-color: rgba(239,68,68,0.3);">
      <div style="font-size:11px; color:#ef4444; text-transform:uppercase; font-weight:bold;">Reason Provided</div>
      <div style="font-size:14px; color:#ffffff; margin-top:6px;">${reason || "No specific reason provided."}</div>
    </div>
  `;

  return sendEmail({
    to: senderEmail,
    subject: `Declined: "${pdf.originalFileName}" by ${declinedRecipient.name}`,
    html: emailWrapper(content, "Document Declined"),
    text: `${declinedRecipient.name} declined to sign "${pdf.originalFileName}". Reason: ${reason}`,
  });
};

export const sendPasswordResetEmail = async ({ email, name, resetToken }) => {
  const resetUrl = `${env.appUrl}/reset-password?token=${resetToken}`;
  
  const content = `
    <h2 style="color:#ffffff; margin-top:0; font-size:20px;">Password Reset Request</h2>
    <p style="color:#9ca3af; font-size:14px; line-height:1.6;">
      Hello <strong style="color:#ffffff;">${name || email}</strong>, we received a request to reset your Signaturly Pro account password.
    </p>

    <div style="text-align:center; margin: 28px 0;">
      <a href="${resetUrl}" class="btn">Reset My Password</a>
    </div>

    <p style="font-size:12px; color:#9ca3af; line-height:1.5;">
      This password reset link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
    </p>

    <p style="font-size:12px; color:#6b7280; margin-top:20px; word-break:break-all;">
      Direct URL: <a href="${resetUrl}" style="color:#ef4444;">${resetUrl}</a>
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
    <h2 style="color:#ffffff; margin-top:0; font-size:20px;">Friendly Reminder: Signature Pending</h2>
    <p style="color:#9ca3af; font-size:14px; line-height:1.6;">
      This is a reminder that <strong style="color:#ffffff;">${sender.name || sender.email}</strong> is awaiting your review and electronic signature on <strong style="color:#ffffff;">${pdf.originalFileName}</strong>.
    </p>

    <div class="card" style="border-color: rgba(239,68,68,0.25);">
      <div style="font-size:11px; color:#f87171; text-transform:uppercase; font-weight:bold;">Pending Action Required</div>
      <div style="font-size:15px; color:#ffffff; font-weight:600; margin-top:4px;">${pdf.originalFileName}</div>
      ${pdf.expiresAt ? `<div style="font-size:12px; color:#fbbf24; margin-top:6px;">⚠️ Expires on: ${new Date(pdf.expiresAt).toLocaleDateString()}</div>` : ""}
      ${customMessage ? `<div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); font-style:italic; color:#d1d5db; font-size:13px;">"${customMessage}"</div>` : ""}
    </div>

    <div style="text-align:center;">
      <a href="${signingUrl}" class="btn">Sign Document Now</a>
    </div>

    <p style="font-size:12px; color:#6b7280; margin-top:24px; text-align:center;">
      Or access directly:<br>
      <a href="${signingUrl}" style="color:#ef4444; word-break:break-all;">${signingUrl}</a>
    </p>
  `;

  return sendEmail({
    to: recipient.email,
    subject: `Reminder: Please sign "${pdf.originalFileName}" from ${sender.name || sender.email}`,
    html: emailWrapper(content, "Signature Reminder"),
    text: `Reminder: Please sign "${pdf.originalFileName}". Link: ${signingUrl}`,
  });
};

