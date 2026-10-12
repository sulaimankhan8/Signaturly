import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireSuperadmin, ADMIN_ROLES } from "../middleware/admin.middleware.js";
import { User } from "../models/User.model.js";
import { env } from "../config/env.js";
import { PLANS } from "../config/plans.js";
import { generateBsaEvidenceCertificate } from "../services/bsaCertificate.service.js";
import { renderInvoicePdf } from "../services/invoice.service.js";
import { verifySecondStep } from "../services/twoFactor.service.js";
import { recordAdminAction } from "../services/adminLog.service.js";
import {
  indiaDay,
  getMeta,
  getOverview,
  getSystem,
  listUsers,
  getUser,
  grantPlan,
  resetUsage,
  suspendUser,
  restoreUser,
  listDocuments,
  getDocument,
  documentExists,
  listAudit,
  listPayments,
  getInvoiceForAdmin,
  listJobs,
  retryJob,
  listDeliveries,
  listActivity,
  listSubscriptions,
  stopUserAutoRenew,
} from "../services/admin.service.js";
import { listPlans, updatePlan, createPlan, pushPlanToRazorpay, createAddOn, updateAddOn } from "../services/planCatalogue.service.js";
import { listEnquiries, updateEnquiry } from "../services/salesEnquiry.service.js";
import { validate, schemas } from "../middlewares/validate.middleware.js";
import { adminLoginLimiter } from "../middlewares/rateLimit.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { safeEqual } from "../utils/tokens.js";

// The operator's side of the service. What each route reads is in services/admin.service.js.
const router = express.Router();

const byId = validate({ params: schemas.adminId });
// Looking at the same account or document again within this time is one line in the record, not many
const QUIET_MS = 10 * 60 * 1000;

// POST /api/admin/login - the admin app's own sign-in
router.post(
  "/login",
  adminLoginLimiter,
  validate({ body: schemas.adminLogin }),
  asyncHandler(async (req, res) => {
    const { email, password, adminSecret, code } = req.body;

    // The caller is told the same thing whatever was wrong; the record says which it was
    const refuse = async (why, status = 401, message = "Invalid admin credentials.") => {
      await recordAdminAction(req, { action: "admin.sign_in_refused", summary: `Sign-in refused for ${email}: ${why}`, meta: { email } });
      throw new ApiError(status, message);
    };

    // 1. The admin key
    if (!env.adminSecret || !safeEqual(adminSecret.trim(), env.adminSecret)) await refuse("wrong admin key");

    // 2. The account and its password
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) await refuse("wrong email or password");

    // 3. The account must already be an admin. Nobody is promoted by logging in;
    //    admins are created only with the seed script.
    if (!ADMIN_ROLES.includes(user.role) || user.deletedAt || user.suspendedAt) await refuse("not an admin account");

    // 4. The second step (plan task P1-25). It is set up in the main app's Settings.
    if (user.twoFactor?.enabled) {
      if (!code) throw new ApiError(401, "TWO_FACTOR_CODE_NEEDED: Enter the code from your authenticator app.");
      if (!(await verifySecondStep(user._id, code))) await refuse("wrong two-step code", 401, "TWO_FACTOR_CODE_WRONG: That code is not right.");
    } else if (env.adminRequire2fa) {
      await refuse(
        "two-step sign-in is not switched on",
        403,
        "TWO_FACTOR_SETUP_NEEDED: Switch on two-step sign-in for this account in the main app's Settings, then sign in here."
      );
    }

    // 5. A token signed with a secret user tokens never use
    const adminToken = jwt.sign({ id: user._id, role: user.role, isAdmin: true }, env.adminJwtSecret, { expiresIn: "8h" });

    const admin = { id: user._id.toString(), email: user.email };
    await recordAdminAction(req, { action: "admin.signed_in", summary: `${user.email} signed in`, admin });

    return res.json({
      adminToken,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  })
);

// Everything below needs an admin session
router.use(requireSuperadmin);

router.get(
  "/meta",
  asyncHandler(async (req, res) => res.json(new ApiResponse(getMeta(req.user), "Admin app details")))
);

router.get(
  "/overview",
  validate({ query: schemas.adminOverview }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await getOverview(req.valid.query), "Overview")))
);

router.get(
  "/system",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await getSystem(), "System state")))
);

// ----- users -----

router.get(
  "/users",
  validate({ query: schemas.adminUsers }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listUsers(req.valid.query), "Users")))
);

router.get(
  "/users/:id",
  byId,
  asyncHandler(async (req, res) => {
    const details = await getUser(req.params.id);
    await recordAdminAction(req, {
      action: "user.opened",
      targetType: "user",
      targetId: req.params.id,
      summary: `Opened the account of ${details.user.email}, with its payments and documents`,
      quietMs: QUIET_MS,
    });
    res.json(new ApiResponse(details, "User"));
  })
);

// Puts an account on a plan without a payment (plan task P2-17)
router.patch(
  "/users/:id/plan",
  validate({ params: schemas.adminId, body: schemas.adminPlanGrant }),
  asyncHandler(async (req, res) => {
    const { user, before, subscription } = await grantPlan(req.params.id, req.body, req.user);

    const allowance = subscription.unlimited ? "no monthly limit" : `${subscription.monthlyQuota} documents a month`;
    const until = subscription.currentPeriodEnd ? `, until ${indiaDay(new Date(subscription.currentPeriodEnd))}` : "";
    await recordAdminAction(req, {
      action: "user.plan_granted",
      targetType: "user",
      targetId: req.params.id,
      summary: `Plan of ${user.email} changed from ${PLANS[before.plan]?.name || before.plan} to ${PLANS[subscription.plan].name} (${allowance}${until}). Reason: ${req.body.reason}`,
      meta: { before: { plan: before.plan, monthlyQuota: before.monthlyQuota }, after: { plan: subscription.plan, monthlyQuota: subscription.monthlyQuota, currentPeriodEnd: subscription.currentPeriodEnd, seats: subscription.seats } },
    });

    res.json(new ApiResponse({ subscription }, `Plan changed to ${PLANS[subscription.plan].name}`));
  })
);

router.post(
  "/users/:id/reset-quota",
  byId,
  asyncHandler(async (req, res) => {
    const { user, before, subscription } = await resetUsage(req.params.id);
    await recordAdminAction(req, {
      action: "user.usage_reset",
      targetType: "user",
      targetId: req.params.id,
      summary: `This month's count of documents for ${user.email} set from ${before} to 0`,
    });
    res.json(new ApiResponse({ subscription }, "This month's count is back to 0"));
  })
);

// Turns off auto-renew on the customer's behalf. They keep what they have paid for.
router.post(
  "/users/:id/auto-renew/stop",
  validate({ params: schemas.adminId, body: schemas.adminReason }),
  asyncHandler(async (req, res) => {
    const { user, before, subscription } = await stopUserAutoRenew(req.params.id);
    await recordAdminAction(req, {
      action: "user.auto_renew_stopped",
      targetType: "user",
      targetId: req.params.id,
      summary: `Turned off auto-renew for ${user.email} (${PLANS[before.plan]?.name || before.plan}${before.renewalAmountInr ? `, Rs. ${before.renewalAmountInr} each renewal` : ""}). Reason: ${req.body.reason}`,
    });
    res.json(new ApiResponse({ subscription }, "Auto-renew is off. The account keeps the time it has paid for."));
  })
);

router.post(
  "/users/:id/suspend",
  validate({ params: schemas.adminId, body: schemas.adminReason }),
  asyncHandler(async (req, res) => {
    const user = await suspendUser(req.params.id, req.body.reason);
    await recordAdminAction(req, {
      action: "user.suspended",
      targetType: "user",
      targetId: req.params.id,
      summary: `Suspended ${user.email}. Reason: ${req.body.reason}`,
    });
    res.json(new ApiResponse({ id: req.params.id }, "Account suspended"));
  })
);

router.post(
  "/users/:id/restore",
  byId,
  asyncHandler(async (req, res) => {
    const user = await restoreUser(req.params.id);
    await recordAdminAction(req, { action: "user.restored", targetType: "user", targetId: req.params.id, summary: `Lifted the suspension of ${user.email}` });
    res.json(new ApiResponse({ id: req.params.id }, "Account restored"));
  })
);

// ----- plans: what is sold, and for how much -----

router.get(
  "/plans",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listPlans(), "Plans")))
);

router.post(
  "/plans",
  validate({ body: schemas.adminPlanCreate }),
  asyncHandler(async (req, res) => {
    const plan = await createPlan(req.body, req.user);
    await recordAdminAction(req, {
      action: "plan.added",
      targetType: "plan",
      targetId: plan.id,
      summary: `Added the plan ${plan.name} (${plan.id})${plan.purchasable ? ", on sale" : ", not on sale"}`,
      meta: { plan },
    });
    res.status(201).json(new ApiResponse({ plan, razorpay: plan.razorpay, razorpayYearly: plan.razorpayYearly }, `${plan.name} added`));
  })
);

router.patch(
  "/plans/:planId",
  validate({ params: schemas.adminPlanParam, body: schemas.adminPlanEdit }),
  asyncHandler(async (req, res) => {
    const { plan, changed, accountsMoved, razorpay, razorpayYearly } = await updatePlan(req.params.planId, req.body, req.user);
    await recordAdminAction(req, {
      action: "plan.changed",
      targetType: "plan",
      targetId: plan.id,
      summary: `Changed the plan ${plan.label} (${plan.id}): ${changed.join("; ")}`,
      meta: { changes: req.body, plan, accountsMoved },
    });
    res.json(new ApiResponse({ plan, accountsMoved, razorpay, razorpayYearly }, `${plan.label} changed`));
  })
);

// What Razorpay has to say about a plan being created there, as one sentence for the record
const razorpaySaid = (razorpay) =>
  ({
    synced: `It is at Razorpay as ${razorpay.providerPlanId}`,
    failed: `Razorpay refused it: ${razorpay.reason}`,
    not_configured: "This server has no Razorpay keys, so it was not created there",
    not_needed: "It is not sold as a subscription, so there is nothing to create at Razorpay",
  })[razorpay.state];

// Creates a plan at Razorpay at its present price, where it is sold as a subscription and is not there yet
router.post(
  "/plans/:planId/razorpay",
  validate({ params: schemas.adminPlanParam }),
  asyncHandler(async (req, res) => {
    const { plan, razorpay } = await pushPlanToRazorpay(req.params.planId);
    await recordAdminAction(req, {
      action: "plan.sent_to_razorpay",
      targetType: "plan",
      targetId: plan.id,
      summary: `Sent the plan ${plan.label} (${plan.id}) to Razorpay. ${razorpaySaid(razorpay)}`,
      meta: { razorpay },
    });
    res.json(new ApiResponse({ razorpay }, razorpaySaid(razorpay)));
  })
);

// ----- top-ups: packs of extra documents -----

router.post(
  "/add-ons",
  validate({ body: schemas.adminAddOnCreate }),
  asyncHandler(async (req, res) => {
    const addOn = await createAddOn(req.body, req.user);
    await recordAdminAction(req, {
      action: "addon.added",
      targetType: "plan",
      targetId: addOn.id,
      summary: `Added the pack ${addOn.id}: ${addOn.documents} extra documents for Rs. ${addOn.priceInr}${addOn.onSale ? "" : ", not on sale"}`,
      meta: { addOn },
    });
    res.status(201).json(new ApiResponse({ addOn }, "Pack added"));
  })
);

router.patch(
  "/add-ons/:addOnId",
  validate({ params: schemas.adminAddOnParam, body: schemas.adminAddOnEdit }),
  asyncHandler(async (req, res) => {
    const { addOn, changed } = await updateAddOn(req.params.addOnId, req.body, req.user);
    await recordAdminAction(req, {
      action: "addon.changed",
      targetType: "plan",
      targetId: addOn.id,
      summary: `Changed the pack ${addOn.id}: ${changed.join("; ")}`,
      meta: { changes: req.body, addOn },
    });
    res.json(new ApiResponse({ addOn }, "Pack changed"));
  })
);

// ----- subscriptions: plans that renew by themselves -----

router.get(
  "/subscriptions",
  validate({ query: schemas.adminSubscriptions }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listSubscriptions(req.valid.query), "Subscriptions")))
);

// ----- enquiries: people who asked to talk to sales -----

router.get(
  "/sales-enquiries",
  validate({ query: schemas.adminEnquiries }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listEnquiries(req.valid.query), "Enquiries")))
);

router.patch(
  "/sales-enquiries/:id",
  byId,
  validate({ body: schemas.adminEnquiryEdit }),
  asyncHandler(async (req, res) => {
    const { enquiry, before } = await updateEnquiry(req.params.id, req.body, req.user);
    await recordAdminAction(req, {
      action: "enquiry.changed",
      targetType: "enquiry",
      targetId: req.params.id,
      summary: `Enquiry from ${enquiry.email}${enquiry.status !== before.status ? ` marked ${enquiry.status}` : " noted"}`,
      meta: { before, after: { status: enquiry.status, note: enquiry.note } },
    });
    res.json(new ApiResponse({ enquiry }, "Enquiry saved"));
  })
);

// ----- documents: details only, never contents -----

router.get(
  "/documents",
  validate({ query: schemas.adminDocuments }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listDocuments(req.valid.query), "Documents")))
);

router.get(
  "/documents/:id",
  byId,
  asyncHandler(async (req, res) => {
    const details = await getDocument(req.params.id);
    await recordAdminAction(req, {
      action: "document.opened",
      targetType: "document",
      targetId: req.params.id,
      summary: `Opened the details of "${details.document.name}"`,
      quietMs: QUIET_MS,
    });
    res.json(new ApiResponse(details, "Document"));
  })
);

// The certificate under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023
router.get(
  "/documents/:id/bsa-certificate",
  byId,
  asyncHandler(async (req, res) => {
    if (!(await documentExists(req.params.id))) throw new ApiError(404, "Document not found");
    const pdfBytes = await generateBsaEvidenceCertificate(req.params.id);
    await recordAdminAction(req, { action: "document.certificate_downloaded", targetType: "document", targetId: req.params.id, summary: "Downloaded the evidence certificate" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="BSA_Sec63_Evidence_Certificate_${req.params.id}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(Buffer.from(pdfBytes));
  })
);

router.get(
  "/audit-logs",
  validate({ query: schemas.adminAudit }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listAudit(req.valid.query), "Audit log")))
);

// ----- money: read only -----

router.get(
  "/payments",
  validate({ query: schemas.adminPayments }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listPayments(req.valid.query), "Payments")))
);

router.get(
  "/invoices/:id/pdf",
  byId,
  asyncHandler(async (req, res) => {
    const invoice = await getInvoiceForAdmin(req.params.id);
    const pdf = await renderInvoicePdf(invoice);
    await recordAdminAction(req, { action: "invoice.downloaded", targetType: "invoice", targetId: req.params.id, summary: `Downloaded invoice ${invoice.number}` });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.number.replace(/\//g, "-")}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).end(pdf);
  })
);

// ----- background work -----

router.get(
  "/jobs",
  validate({ query: schemas.adminJobs }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listJobs(req.valid.query), "Jobs")))
);

router.post(
  "/jobs/:id/retry",
  byId,
  asyncHandler(async (req, res) => {
    const result = await retryJob(req.params.id);
    await recordAdminAction(req, {
      action: "job.run_again",
      targetType: "job",
      targetId: req.params.id,
      summary: `Ran the failed job ${result.type} again: ${result.status}`,
    });
    res.json(new ApiResponse(result, result.status === "done" ? "The job ran and finished" : "The job was tried again"));
  })
);

router.get(
  "/webhook-deliveries",
  validate({ query: schemas.adminDeliveries }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listDeliveries(req.valid.query), "Webhook deliveries")))
);

// ----- what admins did -----

router.get(
  "/activity",
  validate({ query: schemas.adminActivity }),
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listActivity(req.valid.query), "Admin activity")))
);

export default router;
