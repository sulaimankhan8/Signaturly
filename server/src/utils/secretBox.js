import crypto from "crypto";
import { env } from "../config/env.js";

/**
 * Encrypts small secrets before they are stored: two-step sign-in seeds, a workspace's
 * single sign-on client secret, webhook signing secrets.
 *
 * The key comes from DATA_ENCRYPTION_KEY. Without it, it is derived from the audit key, which
 * is never changed once in use. Changing the key makes everything encrypted with it unreadable.
 */
const key = () => crypto.createHash("sha256").update(`secret-box:${env.dataEncryptionKey || env.auditHmacKey || env.accessSecret}`).digest();

export const seal = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
};

// Returns null when the value is missing, was tampered with, or was sealed with another key
export const open = (sealed) => {
  if (typeof sealed !== "string") return null;
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};
