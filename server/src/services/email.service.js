import { sendEmail } from "../config/email.js";
import { env } from "../config/env.js";
import { t } from "../i18n/messages.js";
import { formatDate } from "../utils/format.js";

// Names, file names, messages and reasons come from users, so they are escaped before going into HTML
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const emailWrapper = (content, headerTitle = env.appName, language = "en") => `
<!DOCTYPE html>
<html lang="${esc(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(headerTitle)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #334155; margin: 0; padding: 24px 12px; -webkit-font-smoothing: antialiased; }
    .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); overflow: hidden; }
    .header { background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 2px solid #ef4444; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .body-content { padding: 32px 24px; }
    .btn { display: inline-block; background-color: #dc2626; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; text-align: center; }
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .footer { text-align: center; padding: 18px 24px; color: #64748b; font-size: 12px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; line-height: 1.5; }
    .highlight { color: #dc2626; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${esc(env.appName)}</h1>
    </div>
    <div class="body-content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin:0;">${esc(env.appName)}</p>
    </div>
  </div>
</body>
</html>
`;

const heading = (text, color = "#0f172a") =>
  `<h2 style="color:${color}; margin-top:0; font-size:18px; font-weight:700;">${esc(text)}</h2>`;

const paragraph = (text) =>
  `<p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">${esc(text)}</p>`;

const button = (url, label, color) =>
  `<div style="text-align:center; margin:24px 0;"><a href="${esc(url)}" class="btn"${color ? ` style="background-color:${color};"` : ""}>${esc(label)}</a></div>`;

const documentCard = (language, pdf, extra = "") => `
    <div class="card">
      <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">${esc(t(language, "label.documentTitle"))}</div>
      <div style="font-size:15px; color:#0f172a; font-weight:600; margin-top:4px;">${esc(pdf.originalFileName)}</div>
      ${extra}
    </div>`;

const quotedMessage = (message) =>
  message
    ? `<div style="margin-top:12px; padding-top:12px; border-top:1px solid #e2e8f0; font-style:italic; color:#334155; font-size:13px;">"${esc(message)}"</div>`
    : "";

const senderLabel = (sender) => sender?.name || sender?.email || env.appName;

// Each signer reads their emails in the language chosen for them when the document was sent
export const sendSigningRequestEmail = async ({ recipient, pdf, sender, customMessage }) => {
  const language = recipient.language || "en";
  const signingUrl = `${env.appUrl}/sign/${recipient.token}`;
  const params = { document: pdf.originalFileName, sender: senderLabel(sender), link: signingUrl };

  const content = `
    ${heading(t(language, "request.heading"))}
    ${paragraph(t(language, "request.body", params))}
    ${documentCard(
      language,
      pdf,
      `<div style="font-size:12px; color:#64748b; margin-top:4px;">${esc(t(language, "label.pages", { count: pdf.pageCount }))}</div>${quotedMessage(customMessage)}`
    )}
    ${button(signingUrl, t(language, "request.button"))}
    <p style="font-size:12px; color:#64748b; margin-top:20px; text-align:center; word-break:break-all;">
      ${esc(t(language, "label.linkFallback"))}<br>
      <a href="${esc(signingUrl)}" style="color:#dc2626; text-decoration:underline;">${esc(signingUrl)}</a>
    </p>
  `;

  return sendEmail({
    to: recipient.email,
    subject: t(language, "request.subject", params),
    html: emailWrapper(content, t(language, "request.heading"), language),
    text: t(language, "request.text", params),
  });
};

export const sendCompletionEmail = async ({ recipientEmail, pdf, downloadUrl, language = "en" }) => {
  const fileUrl = /^https?:\/\//.test(downloadUrl || "") ? downloadUrl : `${env.appUrl}${downloadUrl || "/dashboard"}`;
  const params = { document: pdf.originalFileName, link: fileUrl };

  const content = `
    ${heading(t(language, "completed.heading"), "#059669")}
    ${paragraph(t(language, "completed.body", params))}
    ${documentCard(
      language,
      pdf,
      `<div style="font-size:12px; color:#059669; font-weight:600; margin-top:4px;">${esc(t(language, "completed.status"))}</div>`
    )}
    ${button(fileUrl, t(language, "completed.button"), "#059669")}
    <p style="font-size:12px; color:#64748b; text-align:center;">${esc(t(language, "completed.note"))}</p>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: t(language, "completed.subject", params),
    html: emailWrapper(content, t(language, "completed.heading"), language),
    text: t(language, "completed.text", params),
  });
};

export const sendDeclineEmail = async ({ senderEmail, pdf, declinedRecipient, reason }) => {
  const who = declinedRecipient.email || declinedRecipient.phone || "";
  const content = `
    ${heading("Document Signing Declined", "#dc2626")}
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      <strong class="highlight">${esc(declinedRecipient.name)} (${esc(who)})</strong> has declined to sign <strong style="color:#0f172a;">${esc(pdf.originalFileName)}</strong>.
    </p>

    <div class="card" style="border-left: 3px solid #dc2626;">
      <div style="font-size:11px; color:#dc2626; text-transform:uppercase; font-weight:700;">Reason Provided</div>
      <div style="font-size:14px; color:#0f172a; margin-top:4px;">${esc(reason || "No specific reason provided.")}</div>
    </div>
  `;

  return sendEmail({
    to: senderEmail,
    subject: `Declined: "${pdf.originalFileName}" by ${declinedRecipient.name}`,
    html: emailWrapper(content, "Document Declined"),
    text: `${declinedRecipient.name} declined to sign "${pdf.originalFileName}". Reason: ${reason || "none given"}`,
  });
};

export const sendCancellationNotificationEmail = async ({ recipientEmail, recipientName, pdf, eventType = "voided", reason = "", language = "en" }) => {
  const isVoided = eventType === "voided";
  const title = isVoided ? "Document Cancelled / Voided" : "Document Cancelled (Declined by Signer)";
  const description = isVoided
    ? "has been cancelled and voided by the sender."
    : "has been cancelled because another party declined to sign.";

  const content = `
    ${heading(title, "#dc2626")}
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:12px;">Hello ${esc(recipientName || "Signer")},</p>
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      The document <strong>${esc(pdf.originalFileName)}</strong> ${description} Any pending or prior signatures on this document are now void and non-binding.
    </p>

    <div class="card" style="border-left: 3px solid #dc2626;">
      <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Document Status</div>
      <div style="font-size:14px; color:#0f172a; font-weight:600; margin-top:4px;">${esc(pdf.originalFileName)} &mdash; <span style="color:#dc2626;">VOID / CANCELLED</span></div>
      ${reason ? `<div style="font-size:13px; color:#64748b; margin-top:6px;"><em>Reason: ${esc(reason)}</em></div>` : ""}
    </div>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: t(language, "cancelled.subject", { document: pdf.originalFileName }),
    html: emailWrapper(content, "Document Cancelled", language),
    text: `Notice: "${pdf.originalFileName}" has been cancelled. Any prior signatures are void. Reason: ${reason || "N/A"}`,
  });
};

export const sendPasswordResetEmail = async ({ email, name, resetToken }) => {
  const resetUrl = `${env.appUrl}/reset-password?token=${resetToken}`;

  const content = `
    ${heading("Password Reset Request")}
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      Hello <strong style="color:#0f172a;">${esc(name || email)}</strong>, we received a request to reset your ${esc(env.appName)} password.
    </p>
    ${button(resetUrl, "Reset Password")}
    <p style="font-size:12px; color:#64748b; line-height:1.5;">
      This password reset link is valid for <strong>1 hour</strong>. If you did not request this, you can safely ignore this email.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `Reset your ${env.appName} password`,
    html: emailWrapper(content, "Password Reset"),
    text: `Reset your ${env.appName} password: ${resetUrl} (Valid for 1 hour)`,
  });
};

export const sendReminderEmail = async ({ recipient, pdf, sender, customMessage }) => {
  const language = recipient.language || "en";
  const signingUrl = `${env.appUrl}/sign/${recipient.token}`;
  const params = { document: pdf.originalFileName, sender: senderLabel(sender), link: signingUrl };

  const deadline = pdf.expiresAt
    ? `<div style="font-size:12px; color:#d97706; margin-top:4px;">${esc(t(language, "label.deadline", { date: formatDate(pdf.expiresAt) }))}</div>`
    : "";

  const content = `
    ${heading(t(language, "reminder.heading"))}
    ${paragraph(t(language, "reminder.body", params))}
    ${documentCard(language, pdf, `${deadline}${quotedMessage(customMessage)}`)}
    ${button(signingUrl, t(language, "reminder.button"))}
  `;

  return sendEmail({
    to: recipient.email,
    subject: t(language, "reminder.subject", params),
    html: emailWrapper(content, t(language, "reminder.heading"), language),
    text: t(language, "reminder.text", params),
  });
};

export const sendOtpEmail = async ({ email, otp, pdfTitle = "Document", language = "en" }) => {
  const params = { document: pdfTitle, code: otp, app: env.appName };

  const content = `
    ${heading(t(language, "otp.heading"))}
    ${paragraph(t(language, "otp.body", params))}
    <div class="card" style="text-align:center; padding:24px; background-color:#f8fafc;">
      <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; letter-spacing:1px;">${esc(t(language, "otp.label"))}</div>
      <div style="font-size:36px; color:#0f172a; font-weight:800; letter-spacing:8px; margin-top:8px; font-family:monospace;">${esc(otp)}</div>
      <div style="font-size:12px; color:#64748b; margin-top:8px;">${esc(t(language, "otp.note"))}</div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: t(language, "otp.subject", params),
    html: emailWrapper(content, t(language, "otp.heading"), language),
    text: t(language, "otp.text", params),
  });
};

export const sendEmailVerificationEmail = async ({ email, name, token }) => {
  const verifyUrl = `${env.appUrl}/verify-email?token=${token}`;

  const content = `
    ${heading("Confirm your email address")}
    <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
      Hello <strong style="color:#0f172a;">${esc(name || email)}</strong>, please confirm this address so you can send documents for signature.
    </p>
    ${button(verifyUrl, "Confirm Email")}
    <p style="font-size:12px; color:#64748b; line-height:1.5;">
      This link is valid for <strong>24 hours</strong>. If you did not create an account, you can ignore this email.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: "Confirm your email address",
    html: emailWrapper(content, "Confirm Email"),
    text: `Confirm your email address: ${verifyUrl} (valid for 24 hours)`,
  });
};
