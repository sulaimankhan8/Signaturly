import axios from "axios";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

/**
 * Low-level alert dispatcher
 */
const dispatchRawAlert = async ({ text, title = "Signaturly Pro Alert", color = "purple" }) => {
  // 1. Telegram Dispatch
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await axios.post(url, {
        chat_id: TELEGRAM_CHAT_ID,
        text: `⚡ *${title}*\n\n${text}`,
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.warn("⚠️ [Alerts] Telegram alert failed:", err.message);
    }
  }

  // 2. Discord Webhook Dispatch
  if (DISCORD_WEBHOOK_URL) {
    try {
      const colorHex = color === "emerald" ? 0x10b981 : color === "red" ? 0xef4444 : 0x8b5cf6;
      await axios.post(DISCORD_WEBHOOK_URL, {
        embeds: [
          {
            title: `⚡ ${title}`,
            description: text,
            color: colorHex,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (err) {
      console.warn("⚠️ [Alerts] Discord webhook failed:", err.message);
    }
  }

  // 3. Slack Webhook Dispatch
  if (SLACK_WEBHOOK_URL) {
    try {
      await axios.post(SLACK_WEBHOOK_URL, {
        text: `*${title}*\n${text}`,
      });
    } catch (err) {
      console.warn("⚠️ [Alerts] Slack webhook failed:", err.message);
    }
  }

  // 4. Console Fallback for Local Development
  if (!TELEGRAM_BOT_TOKEN && !DISCORD_WEBHOOK_URL && !SLACK_WEBHOOK_URL) {
    console.log(`🔔 [Alert Service Log] ${title}: ${text}`);
  }
};

/**
 * 💰 Dispatched when a user upgrades or purchases a plan
 */
export const sendNewSubscriptionAlert = async ({ userEmail, plan, amount, currency = "USD" }) => {
  const text = `🎉 *New Subscriber Active!*\n• *User:* \`${userEmail}\`\n• *Tier:* \`${plan.toUpperCase()}\`\n• *Amount:* \`${amount} ${currency.toUpperCase()}\`\n• *Time:* ${new Date().toUTCString()}`;
  await dispatchRawAlert({ text, title: "💰 New Subscription Purchased", color: "emerald" });
};

/**
 * ⚠️ Dispatched on unexpected PDF-Lib or SMTP failure spikes
 */
export const sendSystemErrorAlert = async ({ context, error, endpoint, ip }) => {
  const text = `🚨 *Server Exception Detected!*\n• *Context:* ${context}\n• *Endpoint:* \`${endpoint || "N/A"}\`\n• *IP:* \`${ip || "N/A"}\`\n• *Error:* \`${error?.message || error}\``;
  await dispatchRawAlert({ text, title: "⚠️ System Exception Alert", color: "red" });
};

/**
 * 🛡️ Dispatched when brute force or rate limit is breached
 */
export const sendSecurityRateLimitAlert = async ({ ip, route, userAgent }) => {
  const text = `🛡️ *Rate Limiter Triggered!*\n• *IP Address:* \`${ip}\`\n• *Route:* \`${route}\`\n• *User Agent:* \`${userAgent || "N/A"}\`\n• *Action:* Request blocked with 429`;
  await dispatchRawAlert({ text, title: "🛡️ Security Rate Limit", color: "purple" });
};
