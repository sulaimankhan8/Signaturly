import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getOrCreateSubscription, devMockUpgrade, usageOf } from "../services/subscription.service.js";
import { createCheckoutSession, createBillingPortalSession, completeSimulatedOrder, confirmCheckout, checkoutStatus, PLAN_CONFIG } from "../services/billing.service.js";
import { describeEntitlements, describeCatalogue } from "../services/entitlements.service.js";
import { renewalOf, stopAutoRenew, simulateRenewal } from "../services/autoRenew.service.js";
import { getWallet } from "../services/wallet.service.js";
import { listInvoices, getInvoice, renderInvoicePdf, cleanBillingProfile } from "../services/invoice.service.js";
import { User } from "../models/User.model.js";

export const getSubscriptionController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const subscription = await getOrCreateSubscription(userId);

  res.status(200).json(
    new ApiResponse(
      {
        subscription,
        usage: usageOf(subscription),
        // Whether the plan renews by itself, when it ends or is next charged, and what can be done about it
        renewal: renewalOf(subscription),
        // The same figures under the names the dashboard and settings screens read
        quota: {
          envelopesUsedThisMonth: subscription.usedThisMonth,
          monthlyLimit: subscription.monthlyQuota,
          isUnlimited: usageOf(subscription).monthlyQuota === null,
        },
        entitlements: describeEntitlements(subscription),
        availablePlans: PLAN_CONFIG,
        catalogue: describeCatalogue(),
        billingEnabled: env.billingEnabled,
        devSimulation: env.devBillingSimulation,
      },
      "Subscription details retrieved successfully"
    )
  );
});

export const createCheckoutSessionController = asyncHandler(async (req, res) => {
  const { plan, kind, item, seats, renew, addOn, quantity, amountInr } = req.body || {};
  const result = await createCheckoutSession({
    quantity,
    amountInr,
    userId: req.user._id,
    plan,
    kind: typeof kind === "string" ? kind : "plan",
    item,
    seats,
    renew: renew === "auto" ? "auto" : "once",
    addOn: typeof addOn === "string" && addOn ? addOn : undefined,
  });
  res.status(200).json(new ApiResponse(result, "Checkout session initialized"));
});

// The customer is back from Razorpay's checkout: confirm the payment now, without waiting for Razorpay's notice
export const confirmCheckoutController = asyncHandler(async (req, res) => {
  const { razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = req.body;
  const result = await confirmCheckout(req.user.id, { paymentId, orderId, subscriptionId, signature });
  res.status(200).json(new ApiResponse(result, result.confirmed ? "Payment confirmed" : "Payment is still being taken"));
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

// Whether a payment has reached the account yet. Asked by the page a customer lands on after paying.
export const checkoutStatusController = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(await checkoutStatus(req.user.id, req.valid.query), "Payment status"));
});

// Development only: finishes a simulated purchase of a plan, a top-up or wallet credit
export const devPayController = asyncHandler(async (req, res) => {
  const { kind, item, seats, renew, addOn, quantity, amountInr } = req.body || {};
  const done = await completeSimulatedOrder({ quantity, amountInr, userId: req.user.id, kind: String(kind || ""), item: String(item || ""), seats, renew: renew === "auto" ? "auto" : "once", addOn: typeof addOn === "string" && addOn ? addOn : undefined });
  const subscription = await getOrCreateSubscription(req.user._id);
  // The ids let the page shown after paying look the payment up, as it does for a real one
  res.status(200).json(new ApiResponse({ usage: usageOf(subscription), plan: subscription.plan, paymentId: done.paymentId || null, subscriptionId: done.subscriptionId || null }, "Simulated payment applied"));
});

// Stops the plan renewing by itself. The time already paid for is kept.
export const stopAutoRenewController = asyncHandler(async (req, res) => {
  await stopAutoRenew(req.user._id);
  const subscription = await getOrCreateSubscription(req.user._id);
  res.status(200).json(new ApiResponse({ renewal: renewalOf(subscription) }, "Auto-renew is off. Your plan runs until the end of the time you have paid for."));
});

// Development only: the next automatic charge of a simulated subscription
export const devRenewController = asyncHandler(async (req, res) => {
  await simulateRenewal(req.user._id);
  const subscription = await getOrCreateSubscription(req.user._id);
  res.status(200).json(new ApiResponse({ renewal: renewalOf(subscription) }, "Simulated renewal applied"));
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
