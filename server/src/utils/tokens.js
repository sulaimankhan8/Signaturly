import crypto from "crypto";

export const sha256Hex = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

// 256 bits of randomness, URL-safe
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

export const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
