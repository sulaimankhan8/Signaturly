import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { t } from "../../i18n/messages.js";

/**
 * SMS and WhatsApp delivery behind one interface, so the vendor can be swapped without touching callers.
 *
 * A provider is a function ({ channel, to, template, text, params, language }) => Promise.
 * `template` is the provider-side template name (Indian SMS and WhatsApp both require pre-approved
 * templates); `text` is the same message rendered here, used by the development providers.
 *
 * No commercial provider is wired in yet: that needs an account, a registered sender id and approved
 * templates. Until then production refuses SMS and WhatsApp instead of pretending to send.
 */

// In tests every message lands here so codes and links can be read back
export const messageOutbox = [];

const providers = {
  test: async (message) => {
    messageOutbox.push(message);
    return { id: `test-${messageOutbox.length}` };
  },

  // Development: show the message in the server log
  console: async ({ channel, to, text }) => {
    console.log(`\n[${channel.toUpperCase()} to ${to}] ${text}\n`);
    return { id: `console-${Date.now()}` };
  },
};

export const registerMessagingProvider = (name, send) => {
  providers[name] = send;
};

export const TEMPLATES = {
  signing_request: "request.sms",
  reminder: "reminder.sms",
  otp: "otp.sms",
  completed: "completed.sms",
  cancelled: "cancelled.sms",
};

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Accepts +919876543210, 919876543210, 09876543210 or a bare Indian mobile number,
 * and returns the international form. Returns null when the number is not usable.
 */
export const normalizePhone = (input, defaultCountryCode = "91") => {
  if (typeof input !== "string") return null;
  let digits = input.replace(/[\s\-().]/g, "");

  if (digits.startsWith("+")) {
    return E164.test(digits) ? digits : null;
  }
  digits = digits.replace(/^0+/, "");
  if (!/^\d+$/.test(digits)) return null;

  // A bare 10-digit Indian mobile number starts with 6 to 9
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = defaultCountryCode + digits;

  const candidate = `+${digits}`;
  return E164.test(candidate) ? candidate : null;
};

export const maskPhone = (phone = "") => (phone.length > 6 ? `${phone.slice(0, 3)}******${phone.slice(-2)}` : "");

export const isMessagingAvailable = () => Boolean(env.messagingEnabled && providers[env.messagingProvider]);

/**
 * Sends one templated message by SMS or WhatsApp.
 */
export const sendMessage = async ({ channel, to, template, params = {}, language = "en" }) => {
  if (!["sms", "whatsapp"].includes(channel)) {
    throw new Error(`Unsupported messaging channel: ${channel}`);
  }
  if (!TEMPLATES[template]) {
    throw new Error(`Unknown message template: ${template}`);
  }
  if (!isMessagingAvailable()) {
    throw new ApiError(503, "MESSAGING_UNAVAILABLE: SMS and WhatsApp delivery are not set up yet.");
  }

  const phone = normalizePhone(to);
  if (!phone) throw new ApiError(400, "A valid mobile number is required");

  const text = t(language, TEMPLATES[template], { app: env.appName, ...params });
  return providers[env.messagingProvider]({ channel, to: phone, template, text, params, language });
};
