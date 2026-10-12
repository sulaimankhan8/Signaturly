import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { UNLIMITED, MAX_SEATS, isPlan } from "../config/plans.js";
import { TIERS, FEATURE_NAMES } from "../services/entitlements.service.js";

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
    // Express does not let the query be replaced, so the parsed parts (numbers, defaults) are kept here
    req.valid = { ...req.valid, [part]: result.data };
  }
  next();
};

// Shared building blocks
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid identifier");
export const signerToken = z.string().min(16, "Invalid signing link").max(128, "Invalid signing link").regex(/^[A-Za-z0-9-]+$/, "Invalid signing link");
export const email = z.string().trim().toLowerCase().email("A valid email address is required").max(254);
export const password = z.string().min(10, "Password must be at least 10 characters long").max(200);

// Building blocks for the admin app's lists. An empty value in the address ("?plan=") means "not set".
const optional = (schema) => z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
const paged = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};
const searchText = z.string().trim().max(100);
const word = z.string().trim().max(40).regex(/^[a-z_]+$/, "Invalid value");
const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-11");
// Admins can add plans, so the list is read when a request arrives, not when the server starts
const planId = z.string().trim().max(40).refine(isPlan, "Invalid plan specified");
// What an admin may set on a plan. A monthly allowance of null means no monthly limit.
const planName = z.string({ message: "Give the plan a name" }).trim().min(1, "Give the plan a name").max(40);
const planDocuments = z.number({ message: "Enter how many documents a month the plan allows" }).int().min(1, "A plan allows at least 1 document a month").max(UNLIMITED - 1).nullable();
const planPrice = z.number({ message: "Enter the price in whole rupees" }).int("Enter the price in whole rupees").min(1, "A price is at least Rs. 1").max(1000000).nullable();
// Any tier but the free one, which belongs to the Free plan alone
const planTier = z.enum(TIERS.slice(1), { message: "Choose the plan's level" });
const planInterval = z.enum(["month", "year"], { message: "Choose how long one period of the plan lasts" });
// What the plan includes, feature by feature. A feature left out stays as it is.
const planFeatures = z.object(Object.fromEntries(FEATURE_NAMES.map((name) => [name, z.boolean().optional()])));
const packDocuments = z.number({ message: "Enter how many documents the pack adds" }).int().min(1, "A pack adds at least 1 document").max(100000);
const packPrice = z.number({ message: "Enter the price in whole rupees" }).int("Enter the price in whole rupees").min(1, "A price is at least Rs. 1").max(1000000);
// Who the plan is for, in a line
const planTagline = z.string().trim().max(90, "Keep that line to 90 characters");
// A plan's yearly price, and how it is sold. Null: the plan is not sold by the year.
const planYearly = z
  .object({ priceInr: planPrice.optional(), purchasable: z.boolean().optional(), sellSubscription: z.boolean().optional(), sellPrepaid: z.boolean().optional() })
  .nullable();
const planLimits = z.object({ bulkSendMax: z.number({ message: "Enter how many people one bulk send may go to" }).int().min(0).max(100000).optional() });

export const schemas = {
  register: z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    email,
    password,
  }),
  login: z.object({
    email,
    password: z.string().min(1, "Password is required").max(200),
    // The code from an authenticator app, or a recovery code, when two-step sign-in is on
    code: z.string().trim().max(40).optional(),
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
    // The code from an authenticator app, or a recovery code
    code: z.string().trim().max(40).optional(),
  }),
  adminId: z.object({ id: objectId }),
  adminUsers: z.object({
    ...paged,
    search: optional(searchText),
    plan: optional(planId),
    status: optional(z.enum(["active", "unverified", "suspended", "closed"])),
    sort: optional(z.enum(["createdAt", "name", "email", "plan"])),
    order: optional(z.enum(["asc", "desc"])),
  }),
  adminPlanGrant: z.object({
    plan: planId,
    reason: z.string({ message: "Say why the plan is being changed" }).trim().min(3, "Say why the plan is being changed").max(300),
    // How long the plan lasts. Left out, the plan's own period is used.
    days: z.coerce.number().int().min(1).max(3650).optional(),
    // Left out, the account gets the plan's own allowance
    customQuota: z.coerce.number().int().min(1).max(UNLIMITED).optional(),
    seats: z.coerce.number().int().min(1).max(MAX_SEATS).optional(),
  }),
  adminPlanParam: z.object({ planId: z.string().trim().max(40).regex(/^[a-z][a-z0-9_]*$/, "Invalid plan specified") }),
  adminPlanCreate: z.object({
    id: z
      .string({ message: "Give the plan an id" })
      .trim()
      .regex(/^[a-z][a-z0-9_]{2,39}$/, "A plan id is 3 to 40 lowercase letters, digits or underscores, starting with a letter"),
    name: planName,
    tier: planTier,
    interval: planInterval,
    perSeat: z.boolean().default(false),
    documentsPerMonth: planDocuments,
    priceInr: planPrice,
    priceIsFrom: z.boolean().default(false),
    purchasable: z.boolean().default(false),
    sellSubscription: z.boolean().default(true),
    sellPrepaid: z.boolean().default(true),
    features: planFeatures.optional(),
    limits: planLimits.optional(),
    tagline: planTagline.default(""),
    highlight: z.boolean().default(false),
    yearly: planYearly.optional(),
  }),
  // The "Contact sales" form. `website` is a box no person sees or fills in.
  salesEnquiry: z.object({
    name: z.string({ message: "Tell us your name" }).trim().min(1, "Tell us your name").max(80),
    email,
    company: z.string().trim().max(120).default(""),
    teamSize: z.enum(["1-10", "11-50", "51-200", "201+", ""]).default(""),
    message: z.string().trim().max(2000, "Keep the message to 2,000 characters").default(""),
    plan: z.string().trim().max(40).default(""),
    website: z.string().max(200).optional(),
  }),
  adminEnquiries: z.object({
    ...paged,
    status: optional(z.enum(["new", "contacted", "closed"])),
  }),
  adminEnquiryEdit: z
    .object({ status: z.enum(["new", "contacted", "closed"]).optional(), note: z.string().trim().max(1000).optional() })
    .refine((changes) => Object.keys(changes).length > 0, "Nothing to change"),
  // A pack of extra documents
  adminAddOnParam: z.object({ addOnId: z.string().trim().max(40).regex(/^[a-z][a-z0-9_]*$/, "Invalid pack specified") }),
  adminAddOnCreate: z.object({
    id: z
      .string({ message: "Give the pack an id" })
      .trim()
      .regex(/^[a-z][a-z0-9_]{2,39}$/, "A pack id is 3 to 40 lowercase letters, digits or underscores, starting with a letter"),
    documents: packDocuments,
    priceInr: packPrice,
    onSale: z.boolean().default(true),
  }),
  adminAddOnEdit: z
    .object({ documents: packDocuments.optional(), priceInr: packPrice.optional(), onSale: z.boolean().optional() })
    .refine((changes) => Object.keys(changes).length > 0, "Nothing to change"),
  adminSubscriptions: z.object({
    ...paged,
    state: optional(z.enum(["active", "overdue", "ending"])),
    plan: optional(planId),
  }),
  // Which payment, or which subscription approved with nothing charged yet, the page shown after paying asks about
  billingStatus: z
    .object({
      paymentId: optional(z.string().trim().max(80).regex(/^[\w-]+$/, "Invalid payment")),
      subscriptionId: optional(z.string().trim().max(80).regex(/^[\w-]+$/, "Invalid subscription")),
    })
    .refine((asked) => Boolean(asked.paymentId || asked.subscriptionId), "Say which payment to look up"),
  // What Razorpay's checkout hands the browser after a payment: the ids and Razorpay's signature over them
  billingConfirm: z
    .object({
      razorpay_payment_id: z.string().trim().min(1).max(60),
      razorpay_order_id: z.string().trim().min(1).max(60).optional(),
      razorpay_subscription_id: z.string().trim().min(1).max(60).optional(),
      razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i, "That payment could not be confirmed"),
    })
    .refine((sent) => Boolean(sent.razorpay_order_id) !== Boolean(sent.razorpay_subscription_id), "That payment could not be confirmed"),
  // Only what is sent is changed
  adminPlanEdit: z
    .object({
      name: planName.optional(),
      tier: planTier.optional(),
      interval: planInterval.optional(),
      perSeat: z.boolean().optional(),
      features: planFeatures.optional(),
      limits: planLimits.optional(),
      // How the plan may be bought while it is on sale
      sellSubscription: z.boolean().optional(),
      sellPrepaid: z.boolean().optional(),
      documentsPerMonth: planDocuments.optional(),
      priceInr: planPrice.optional(),
      priceIsFrom: z.boolean().optional(),
      purchasable: z.boolean().optional(),
      legacy: z.boolean().optional(),
      tagline: planTagline.optional(),
      highlight: z.boolean().optional(),
      yearly: planYearly.optional(),
    })
    .refine((changes) => Object.keys(changes).length > 0, "Nothing to change"),
  adminReason: z.object({
    reason: z.string({ message: "Give a reason" }).trim().min(3, "Give a reason").max(300),
  }),
  adminDocuments: z.object({
    ...paged,
    search: optional(searchText),
    status: optional(word),
    owner: optional(objectId),
    show: optional(z.enum(["live", "deleted", "test"])),
  }),
  adminAudit: z.object({
    ...paged,
    event: optional(word),
    document: optional(objectId),
    from: optional(calendarDay),
    to: optional(calendarDay),
  }),
  adminPayments: z.object({
    ...paged,
    kind: optional(word),
    provider: optional(z.enum(["stripe", "razorpay"])),
    user: optional(objectId),
    from: optional(calendarDay),
    to: optional(calendarDay),
  }),
  adminJobs: z.object({
    ...paged,
    status: optional(z.enum(["pending", "running", "done", "failed"])),
    type: optional(z.string().trim().max(60).regex(/^[\w.:-]+$/, "Invalid job type")),
  }),
  adminDeliveries: z.object({
    ...paged,
    status: optional(z.enum(["pending", "delivered", "failed"])),
  }),
  adminActivity: z.object({
    ...paged,
    action: optional(z.string().trim().max(60).regex(/^[\w.]+$/, "Invalid action")),
    target: optional(z.string().trim().max(60).regex(/^[\w-]+$/, "Invalid target")),
  }),
  adminOverview: z.object({
    range: optional(z.enum(["7d", "14d", "30d", "90d"])),
  }),
  verifyHash: z.object({
    hash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, "Provide a 64-character SHA-256 hash").optional(),
  }).passthrough(),
};
