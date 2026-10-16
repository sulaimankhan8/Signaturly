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

// Shown under emails about documents sent from a Free account
const badgeLine = (language) =>
  `<p style="margin:0 0 6px 0;">${esc(t(language, "badge.line", { app: env.appName }))} <a href="${esc(env.appUrl)}" style="color:#dc2626;">${esc(t(language, "badge.cta"))}</a></p>`;

// A workspace's colour is used only when it is a plain six-digit hex value
const brandColor = (brand) => (/^#[0-9a-f]{6}$/i.test(brand?.primaryColor || "") ? brand.primaryColor : null);

// Email programs show images only from web addresses, so a logo stored as a data URL is left out
const brandHeader = (brand) => {
  const name = esc(brand?.companyName || env.appName);
  if (/^https:\/\//i.test(brand?.logoUrl || "")) {
    return `<img src="${esc(brand.logoUrl)}" alt="${name}" style="max-height:44px; max-width:220px;">`;
  }
  // PactDoc's own logo (client/public/brand), when no workspace name replaces it and the app is at
  // an https address email programs will fetch from; sized by attribute too, for Outlook
  if (!brand?.companyName && /^https:\/\//i.test(env.appUrl)) {
    const src = `${env.appUrl.replace(/\/+$/, "")}/brand/pactdoc-logo-on-dark@2x.png`;
    return `<img src="${esc(src)}" alt="${esc(env.appName)}" width="151" height="36" style="display:inline-block; width:151px; height:36px; border:0;">`;
  }
  return `<h1>${name}</h1>`;
};

const emailWrapper = (content, headerTitle = env.appName, language = "en", { showBadge = false, brand = null } = {}) => `
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
    ${brandColor(brand) ? `.header { border-bottom-color: ${brandColor(brand)}; } .btn { background-color: ${brandColor(brand)}; }` : ""}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${brandHeader(brand)}
    </div>
    <div class="body-content">
      ${content}
    </div>
    <div class="footer">
      ${showBadge ? badgeLine(language) : ""}
      ${brand?.emailFooterText ? `<p style="margin:0 0 6px 0;">${esc(brand.emailFooterText)}</p>` : ""}
      <p style="margin:0;">${brand?.companyName ? `${esc(brand.companyName)} &middot; ` : ""}${esc(env.appName)}</p>
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
export const sendSigningRequestEmail = async ({ recipient, pdf, sender, customMessage, showBadge = false, brand = null }) => {
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
    // The sender's own subject line where they set one (a paid plan feature)
    subject: pdf.emailSubject || t(language, "request.subject", params),
    html: emailWrapper(content, t(language, "request.heading"), language, { showBadge, brand }),
    text: t(language, "request.text", params),
  });
};

export const sendCompletionEmail = async ({ recipientEmail, pdf, downloadUrl, language = "en", showBadge = false, brand = null }) => {
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
    html: emailWrapper(content, t(language, "completed.heading"), language, { showBadge, brand }),
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

export const sendReminderEmail = async ({ recipient, pdf, sender, customMessage, showBadge = false, brand = null }) => {
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
    html: emailWrapper(content, t(language, "reminder.heading"), language, { showBadge, brand }),
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

export const sendWorkspaceInvitationEmail = async ({ email, workspaceName, inviterName, role, link, hasAccount }) => {
  const content = `
    ${heading(`You are invited to ${workspaceName}`)}
    ${paragraph(`${inviterName} has invited you to join the workspace "${workspaceName}" on ${env.appName} as ${role === "admin" ? "an admin" : `a ${role}`}.`)}
    ${button(link, "Accept Invitation")}
    <p style="font-size:12px; color:#64748b; line-height:1.5;">
      ${hasAccount ? "Sign in with this email address to accept." : "You will be asked to create an account with this email address first."}
      This invitation is valid for <strong>7 days</strong>. If you were not expecting it, you can ignore this email.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `${inviterName} invited you to ${workspaceName} on ${env.appName}`,
    html: emailWrapper(content, "Workspace invitation"),
    text: `${inviterName} invited you to join "${workspaceName}" on ${env.appName}. Accept here: ${link}`,
  });
};

export const sendTwoFactorReminderEmail = async ({ email, name, workspaceName, askedBy, link }) => {
  const content = `
    ${heading("Please switch on two-step sign-in")}
    ${paragraph(`Hello ${name || email}, ${askedBy} asks everyone in "${workspaceName}" to use two-step sign-in, so a stolen password alone can't open the team's documents.`)}
    ${paragraph("It takes about a minute with an authenticator app on your phone.")}
    ${button(link, "Set it up")}
  `;

  return sendEmail({
    to: email,
    subject: `${workspaceName}: please switch on two-step sign-in`,
    html: emailWrapper(content, "Two-step sign-in"),
    text: `${askedBy} asks everyone in "${workspaceName}" to switch on two-step sign-in. Set it up here: ${link}`,
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

/**
 * Tells whoever follows up sales that someone has asked to talk about a plan. The answer goes
 * to the person who asked: their address is the reply-to.
 */
export const sendSalesEnquiryEmail = async ({ to, enquiry }) => {
  const facts = [
    ["Name", enquiry.name],
    ["Email", enquiry.email],
    ["Company", enquiry.company],
    ["People who would use it", enquiry.teamSize],
    ["Asked about", enquiry.planName],
  ].filter(([, value]) => value);

  const content = `
    ${heading("Someone asked to talk to sales")}
    ${paragraph(`${enquiry.name} sent the “Contact sales” form. Reply to this email to answer them.`)}
    <div class="card">${facts
      .map(
        ([label, value]) =>
          `<div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; margin-top:8px;">${esc(label)}</div><div style="font-size:14px; color:#0f172a; font-weight:600; margin-top:2px;">${esc(value)}</div>`
      )
      .join("")}</div>
    ${enquiry.message ? paragraph(enquiry.message) : ""}
  `;

  return sendEmail({
    to,
    replyTo: enquiry.email,
    subject: `Sales enquiry from ${enquiry.name}${enquiry.company ? ` (${enquiry.company})` : ""}`,
    html: emailWrapper(content, "Sales enquiry"),
    text: [...facts.map(([label, value]) => `${label}: ${value}`), "", enquiry.message].join("\n"),
  });
};

/**
 * An email about a customer's plan or a payment: what happened, in a sentence or two, and a
 * way to the Billing page. `lines` are plain sentences; `facts` are label and value pairs
 * shown together (what was paid for, how much, the invoice number).
 */
export const sendBillingEmail = async ({ email, name, subject, title, lines = [], facts = [], action = null }) => {
  // The button leads to Billing, or to the one thing the email asks for (`action`: a path in the app and its label)
  const billingUrl = `${env.appUrl}${action?.path || "/billing"}`;
  const buttonLabel = action?.label || "Open Billing";
  const shown = facts.filter(([, value]) => value !== undefined && value !== null && value !== "");

  const content = `
    ${heading(title)}
    ${paragraph(`Hello ${name || email},`)}
    ${lines.map(paragraph).join("")}
    ${
      shown.length
        ? `<div class="card">${shown
            .map(
              ([label, value]) =>
                `<div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; margin-top:8px;">${esc(label)}</div><div style="font-size:14px; color:#0f172a; font-weight:600; margin-top:2px;">${esc(value)}</div>`
            )
            .join("")}</div>`
        : ""
    }
    ${button(billingUrl, buttonLabel)}
  `;

  return sendEmail({
    to: email,
    subject,
    html: emailWrapper(content, title),
    text: [`Hello ${name || email},`, ...lines, ...shown.map(([label, value]) => `${label}: ${value}`), `${buttonLabel}: ${billingUrl}`].join("\n"),
  });
};
