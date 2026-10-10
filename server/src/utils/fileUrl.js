import crypto from "crypto";
import { env } from "../config/env.js";

const sign = (key, exp) =>
  crypto.createHmac("sha256", env.fileUrlSecret).update(`${key}\n${exp}`).digest("hex");

/**
 * Builds a short-lived link to a stored file, served through /uploads.
 * The link carries its own expiry and signature, so no login token ever goes in a URL.
 */
export const buildSignedFileUrl = (key, ttlSeconds = env.fileUrlTtlSeconds) => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `/uploads/${encodedKey}?exp=${exp}&sig=${sign(key, exp)}`;
};

export const verifySignedFileUrl = (key, exp, sig) => {
  const expiry = Number(exp);
  if (!key || !Number.isFinite(expiry) || typeof sig !== "string") return false;
  if (expiry < Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(key, expiry), "hex");
  let provided;
  try {
    provided = Buffer.from(sig, "hex");
  } catch {
    return false;
  }
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
};
