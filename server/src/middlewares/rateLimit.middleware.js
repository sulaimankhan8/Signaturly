import rateLimit from "express-rate-limit";
import { RateLimit } from "../models/RateLimit.model.js";
import { env } from "../config/env.js";

// Minimal MongoDB-backed store so limits hold across instances and restarts
class MongoRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const id = `${this.prefix}:${key}`;
    const now = new Date();
    const fresh = new Date(now.getTime() + this.windowMs);

    let doc = await RateLimit.findOneAndUpdate(
      { key: id, expiresAt: { $gt: now } },
      { $inc: { hits: 1 } },
      { new: true }
    );

    if (!doc) {
      try {
        doc = await RateLimit.findOneAndUpdate(
          { key: id },
          { $set: { hits: 1, expiresAt: fresh } },
          { new: true, upsert: true }
        );
      } catch (err) {
        // Two first requests raced on the unique key; count this one against the winner
        if (err?.code !== 11000) throw err;
        doc = await RateLimit.findOneAndUpdate({ key: id }, { $inc: { hits: 1 } }, { new: true });
      }
    }

    return { totalHits: doc.hits, resetTime: doc.expiresAt };
  }

  async decrement(key) {
    await RateLimit.updateOne({ key: `${this.prefix}:${key}`, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await RateLimit.deleteOne({ key: `${this.prefix}:${key}` });
  }
}

const createLimiter = ({ name, windowMs, limit, keyGenerator, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: new MongoRateLimitStore(name),
    skip: () => env.rateLimitDisabled,
    validate: { keyGeneratorIpFallback: false },
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message || "Too many requests. Please wait and try again.",
        error: message || "Too many requests. Please wait and try again.",
      });
    },
  });

const MINUTE = 60 * 1000;

const signerTokenKey = (req) => {
  const token = req.params?.token || req.body?.token;
  return typeof token === "string" && token ? `t:${token.slice(0, 64)}` : `ip:${req.ip}`;
};

// Sign-in and account creation: slow down password guessing and sign-up floods
export const loginLimiter = createLimiter({ name: "login", windowMs: 15 * MINUTE, limit: 10 });
export const registerLimiter = createLimiter({ name: "register", windowMs: 60 * MINUTE, limit: 10 });
export const passwordResetLimiter = createLimiter({ name: "pwreset", windowMs: 60 * MINUTE, limit: 5 });
export const refreshLimiter = createLimiter({ name: "refresh", windowMs: 15 * MINUTE, limit: 120 });

// Signer verification: per signing link, so one signer cannot be flooded or brute-forced
export const otpSendLimiter = createLimiter({ name: "otpsend", windowMs: 60 * MINUTE, limit: 8, keyGenerator: signerTokenKey });
export const otpVerifyLimiter = createLimiter({ name: "otpverify", windowMs: 15 * MINUTE, limit: 20, keyGenerator: signerTokenKey });

// Public signing and verification endpoints
export const signingLimiter = createLimiter({ name: "signing", windowMs: MINUTE, limit: 60 });
export const verifyLimiter = createLimiter({ name: "verify", windowMs: 15 * MINUTE, limit: 30 });
export const adminLoginLimiter = createLimiter({ name: "adminlogin", windowMs: 15 * MINUTE, limit: 5 });

// Everything else under /api
export const apiLimiter = createLimiter({ name: "api", windowMs: MINUTE, limit: 300 });
