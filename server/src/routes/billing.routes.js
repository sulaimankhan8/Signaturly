import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getSubscriptionController,
  createCheckoutSessionController,
  confirmCheckoutController,
  checkoutStatusController,
  devMockUpgradeController,
  devPayController,
  devRenewController,
  stopAutoRenewController,
  createBillingPortalController,
  getWalletController,
  getBillingProfileController,
  updateBillingProfileController,
  listInvoicesController,
  downloadInvoiceController,
} from "../controllers/billing.controller.js";
import { validate, schemas } from "../middlewares/validate.middleware.js";
import { env } from "../config/env.js";

const router = Router();

router.use(protect); // All billing routes require authenticated user

router.get("/subscription", getSubscriptionController);
router.post("/checkout", createCheckoutSessionController);
router.post("/checkout/confirm", validate({ body: schemas.billingConfirm }), confirmCheckoutController);
router.get("/checkout/status", validate({ query: schemas.billingStatus }), checkoutStatusController);
router.post("/auto-renew/stop", stopAutoRenewController);
router.post("/portal", createBillingPortalController);

router.get("/wallet", getWalletController);
router.get("/profile", getBillingProfileController);
router.put("/profile", updateBillingProfileController);
router.get("/invoices", listInvoicesController);
router.get("/invoices/:id/pdf", downloadInvoiceController);

// Simulated purchases exist only outside production; in production these routes are not registered at all
if (env.devBillingSimulation) {
  router.post("/dev-upgrade", devMockUpgradeController);
  router.post("/dev-pay", devPayController);
  router.post("/dev-renew", devRenewController);
}

export default router;
