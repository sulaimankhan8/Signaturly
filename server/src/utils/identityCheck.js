/**
 * Says, in words, how a signer proved who they are. Used in the audit log, on the signing record
 * and on the public verification page, so all three always agree.
 *
 * A stronger check is named only when the signer actually passed it on the server.
 */
export const describeIdentityCheck = (recipient) => {
  if (!recipient) return "Account login";

  const link = recipient.channel && recipient.channel !== "email"
    ? recipient.channel === "whatsapp" ? "WhatsApp link" : "SMS link"
    : "Email link";

  const passed = recipient.authVerified === true && Boolean(recipient.authVerifiedAt);
  if (passed && recipient.authMethod === "email_otp") return `${link} + one-time code`;
  if (passed && recipient.authMethod === "sms_otp") return `${link} + one-time code by SMS`;
  if (passed && recipient.authMethod === "passcode") return `${link} + access passcode`;
  return link;
};
