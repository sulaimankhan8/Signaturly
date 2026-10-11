import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getOrCreateSubscription, devMockUpgrade, usageOf } from "../services/subscription.service.js";
import { createCheckoutSession, createBillingPortalSession, completeSimulatedOrder, PLAN_CONFIG } from "../services/billing.service.js";
import { describeEntitlements } from "../services/entitlements.service.js";
import { getWallet } from "../services/wallet.service.js";
import { listInvoices, getInvoice, renderInvoicePdf, cleanBillingProfile } from "../services/invoice.service.js";
import { publicCatalogue } from "../config/plans.js";
import { User } from "../models/User.model.js";

export const getSubscriptionController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const subscription = await getOrCreateSubscription(userId);

  res.status(200).json(
    new ApiResponse(
      {
        subscription,
        usage: usageOf(subscription),
        // The same figures under the names the dashboard and settings screens read
        quota: {
          envelopesUsedThisMonth: subscription.usedThisMonth,
          monthlyLimit: subscription.monthlyQuota,
          isUnlimited: usageOf(subscription).monthlyQuota === null,
        },
        entitlements: describeEntitlements(subscription),
        availablePlans: PLAN_CONFIG,
        catalogue: publicCatalogue(),
        billingEnabled: env.billingEnabled,
        devSimulation: env.devBillingSimulation,
      },
      "Subscription details retrieved successfully"
    )
  );
});

export const createCheckoutSessionController = asyncHandler(async (req, res) => {
  const { plan, kind, item, seats } = req.body || {};
  const result = await createCheckoutSession({ userId: req.user._id, plan, kind: typeof kind === "string" ? kind : "plan", item, seats });
  res.status(200).json(new ApiResponse(result, "Checkout session initialized"));
});

export const devMockUpgradeController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { plan } = req.body;

  const updatedSubscription = await devMockUpgrade(userId, plan);

  res.status(200).json(
    new ApiResponse(
      updatedSubscription,
      `Successfully upgraded to ${plan} (Dev Simulation Mode)`
    )
  );
});

// Development only: finishes a simulated purchase of a plan, a top-up or wallet credit
export const devPayController = asyncHandler(async (req, res) => {
  const { kind, item, seats } = req.body || {};
  await completeSimulatedOrder({ userId: req.user.id, kind: String(kind || ""), item: String(item || ""), seats });
  const subscription = await getOrCreateSubscription(req.user._id);
  res.status(200).json(new ApiResponse({ usage: usageOf(subscription), plan: subscription.plan }, "Simulated payment applied"));
});

export const createBillingPortalController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const result = await createBillingPortalSession(userId);

  res.status(200).json(
    new ApiResponse(result, "Billing portal URL generated")
  );
});

export const getWalletController = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(await getWallet(req.user.id), "Wallet"));
});

export const getBillingProfileController = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  res.status(200).json(new ApiResponse(user?.billing || { legalName: "", address: "", gstin: "", stateCode: "" }, "Billing details"));
});

export const updateBillingProfileController = asyncHandler(async (req, res) => {
  const billing = cleanBillingProfile(req.body);
  await User.updateOne({ _id: req.user.id }, { $set: { billing } });
  res.status(200).json(new ApiResponse(billing, "Billing details saved"));
});

export const listInvoicesController = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(await listInvoices(req.user.id), "Invoices"));
});

export const downloadInvoiceController = asyncHandler(async (req, res) => {
  const invoice = await getInvoice(req.params.id, req.user.id);
  const pdf = await renderInvoicePdf(invoice);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.number.replace(/\//g, "-")}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).end(pdf);
});
