import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";

const hasOperatorKey = (value, depth = 0) => {
  if (!value || typeof value !== "object" || depth > 12) return false;
  if (Array.isArray(value)) return value.some((item) => hasOperatorKey(item, depth + 1));
  return Object.keys(value).some(
    (key) => key.startsWith("$") || hasOperatorKey(value[key], depth + 1)
  );
};

/**
 * Rejects any request whose body, query or params carry a database operator key
 * such as {"token": {"$ne": null}}. Applied to every API route.
 */
export const rejectOperatorKeys = (req, res, next) => {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query) || hasOperatorKey(req.params)) {
    return next(new ApiError(400, "Request contains characters that are not allowed"));
  }
  next();
};

/**
 * Validates parts of a request against zod schemas and replaces the body with the parsed value.
 * Usage: validate({ body: schema, params: schema, query: schema })
 */
export const validate = (schemas) => (req, res, next) => {
  for (const part of ["params", "query", "body"]) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return next(new ApiError(400, errors[0]?.message || "Invalid request", errors));
    }
    if (part === "body") req.body = result.data;
  }
  next();
};

// Shared building blocks
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid identifier");
export const signerToken = z.string().min(16, "Invalid signing link").max(128, "Invalid signing link").regex(/^[A-Za-z0-9-]+$/, "Invalid signing link");
export const email = z.string().trim().toLowerCase().email("A valid email address is required").max(254);
export const password = z.string().min(10, "Password must be at least 10 characters long").max(200);

export const schemas = {
  register: z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    email,
    password,
  }),
  login: z.object({
    email,
    password: z.string().min(1, "Password is required").max(200),
  }),
  forgotPassword: z.object({ email }),
  resetPassword: z.object({
    token: z.string().min(16).max(200),
    newPassword: password,
  }),
  changePassword: z.object({
    currentPassword: z.string().min(1).max(200),
    newPassword: password,
  }),
  otpSend: z.object({ token: signerToken }),
  otpVerify: z.object({
    token: signerToken,
    otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  }),
  passcodeVerify: z.object({
    token: signerToken,
    passcode: z.string().trim().min(1, "Passcode is required").max(100),
  }),
  signerTokenParam: z.object({ token: signerToken }),
  signSubmit: z.object({
    fields: z.array(z.object({ id: z.string().min(1).max(200) }).passthrough()).max(500).default([]),
    consent: z.literal(true, { message: "You must agree to sign electronically before completing" }),
    consentVersion: z.string().max(40).optional(),
  }),
  signDecline: z.object({
    reason: z.string().trim().max(1000).optional(),
  }),
  adminLogin: z.object({
    email,
    password: z.string().min(1).max(200),
    adminSecret: z.string().min(1).max(500),
  }),
  verifyHash: z.object({
    hash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, "Provide a 64-character SHA-256 hash").optional(),
  }).passthrough(),
};
