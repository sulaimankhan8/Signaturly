import crypto from "crypto";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { seal, open } from "../utils/secretBox.js";
import { sha256Hex } from "../utils/tokens.js";

/**
 * Two-step sign-in with an authenticator app (time-based one-time codes, RFC 6238).
 *
 * Setting it up takes two calls: `begin` gives the secret to add to the app, and `confirm`
 * switches it on once the user has typed a code the app produced, which proves the app is set
 * up. Ten recovery codes are given at that moment, each usable once, for a lost phone.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

const toBase32 = (buffer) => {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
};

const fromBase32 = (text) => {
  let bits = "";
  for (const char of String(text).toUpperCase().replace(/[^A-Z2-7]/g, "")) bits += BASE32.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

// The six-digit code for one 30-second step
export const codeAt = (secret, step) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac("sha1", fromBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const number = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(number % 1000000).padStart(6, "0");
};

const stepNow = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Checks a code against the secret, allowing the step before and after for clock drift.
 * Returns the step that matched, or null. The caller stores it so a code cannot be used twice.
 */
export const matchingStep = (secret, code, now = Date.now()) => {
  const typed = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(typed)) return null;
  for (const offset of [0, -1, 1]) {
    const step = stepNow(now) + offset;
    const expected = codeAt(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(typed))) return step;
  }
  return null;
};

const loadUser = async (userId) => {
  const user = await User.findById(userId).select("+twoFactor.secret +twoFactor.pendingSecret +twoFactor.recoveryHashes +twoFactor.lastStep");
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

/**
 * Starts set-up: makes a new secret and returns it with the address authenticator apps read.
 * Nothing changes for the account until the secret is confirmed.
 */
export const beginTwoFactor = async (userId) => {
  const user = await loadUser(userId);
  if (user.twoFactor?.enabled) throw new ApiError(409, "Two-step sign-in is already on");

  const secret = toBase32(crypto.randomBytes(20));
  await User.updateOne({ _id: user._id }, { $set: { "twoFactor.pendingSecret": seal(secret) } });

  const label = encodeURIComponent(`${env.appName}:${user.email}`);
  return {
    secret,
    otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(env.appName)}&digits=6&period=${STEP_SECONDS}`,
  };
};

/**
 * Finishes set-up with a code from the app. Returns the recovery codes, shown once.
 */
export const confirmTwoFactor = async (userId, code) => {
  const user = await loadUser(userId);
  const secret = open(user.twoFactor?.pendingSecret);
  if (!secret) throw new ApiError(400, "Start setting up two-step sign-in first");

  const step = matchingStep(secret, code);
  if (step === null) throw new ApiError(400, "That code is not right. Check the time on your phone and try the newest code.");

  const recoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(5).toString("hex"));
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        "twoFactor.enabled": true,
        "twoFactor.secret": seal(secret),
        "twoFactor.enabledAt": new Date(),
        "twoFactor.lastStep": step,
        "twoFactor.recoveryHashes": recoveryCodes.map(sha256Hex),
      },
      $unset: { "twoFactor.pendingSecret": 1 },
    }
  );
  return { recoveryCodes };
};

/**
 * Checks the second step of a sign-in: a code from the app, or one of the recovery codes.
 * A code from the app works once; so does each recovery code.
 */
export const verifySecondStep = async (userId, code) => {
  const user = await loadUser(userId);
  if (!user.twoFactor?.enabled) return true;

  const typed = String(code || "").trim().toLowerCase();
  if (!typed) return false;

  const secret = open(user.twoFactor.secret);
  const step = secret ? matchingStep(secret, typed) : null;
  if (step !== null) {
    // Only a step newer than the last one used is accepted, and the update is one step in the
    // database, so the same code cannot sign in twice
    const used = await User.updateOne(
      { _id: user._id, $or: [{ "twoFactor.lastStep": { $lt: step } }, { "twoFactor.lastStep": null }, { "twoFactor.lastStep": { $exists: false } }] },
      { $set: { "twoFactor.lastStep": step } }
    );
    return used.modifiedCount === 1;
  }

  const hash = sha256Hex(typed.replace(/[^a-f0-9]/g, ""));
  const spent = await User.updateOne({ _id: user._id, "twoFactor.recoveryHashes": hash }, { $pull: { "twoFactor.recoveryHashes": hash } });
  return spent.modifiedCount === 1;
};

/**
 * Switches two-step sign-in off. Needs a current code, so a stolen session cannot remove it.
 */
export const disableTwoFactor = async (userId, code) => {
  if (!(await verifySecondStep(userId, code))) throw new ApiError(400, "That code is not right");
  await User.updateOne(
    { _id: userId },
    { $set: { "twoFactor.enabled": false }, $unset: { "twoFactor.secret": 1, "twoFactor.pendingSecret": 1, "twoFactor.recoveryHashes": 1, "twoFactor.lastStep": 1, "twoFactor.enabledAt": 1 } }
  );
};

export const twoFactorStatus = async (userId) => {
  const user = await loadUser(userId);
  return { enabled: Boolean(user.twoFactor?.enabled), enabledAt: user.twoFactor?.enabledAt || null, recoveryCodesLeft: user.twoFactor?.recoveryHashes?.length || 0 };
};
