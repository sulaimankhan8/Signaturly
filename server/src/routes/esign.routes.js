import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { signingLimiter } from "../middlewares/rateLimit.middleware.js";
import { validate, schemas } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  startEsign,
  completeEsign,
  handleProviderCallback,
  reportStandInOutcome,
  switchToOrdinarySigning,
  esignAvailable,
} from "../services/esign/esign.service.js";
import { USAGE_PRICES_PAISE } from "../config/plans.js";

// Aadhaar eSign (plan tasks P6-02 to P6-06). The signer's routes are public and identified by
// the signing link's token, like the rest of signing.
const router = Router();

const context = (req) => ({ ipAddress: req.ip || req.socket?.remoteAddress, userAgent: req.headers["user-agent"] });

// Whether senders can choose Aadhaar eSign, and what one signature costs
router.get("/availability", (req, res) => {
  res.json(new ApiResponse({ available: esignAvailable(), pricePaise: USAGE_PRICES_PAISE.aadhaarEsign }, "Aadhaar eSign"));
});

// A notice from the provider's servers. Checked by the provider's own code before it is believed.
router.post(
  "/callback/:provider",
  asyncHandler(async (req, res) => res.json(await handleProviderCallback(String(req.params.provider), req)))
);

// Development only: the stand-in provider's page
router.post(
  "/stand-in/:transactionId",
  signingLimiter,
  asyncHandler(async (req, res) => {
    const result = await reportStandInOutcome({ transactionId: req.params.transactionId, outcome: req.body?.outcome, name: req.body?.name });
    res.json(new ApiResponse(result, "Recorded"));
  })
);

// The sender switches a signer back to ordinary signing
router.post(
  "/recipients/:recipientId/use-ordinary-signing",
  protect,
  asyncHandler(async (req, res) => {
    const result = await switchToOrdinarySigning({ recipientId: req.params.recipientId, userId: req.user.id });
    res.json(new ApiResponse(result, "This signer will now sign in the ordinary way"));
  })
);

router.post(
  "/:token/start",
  signingLimiter,
  validate({ params: schemas.signerTokenParam, body: schemas.signSubmit }),
  asyncHandler(async (req, res) => {
    const { fields, consent, consentVersion } = req.body;
    const result = await startEsign({ token: req.params.token, filledFields: fields, consent, consentVersion, ...context(req) });
    res.json(new ApiResponse(result, "Continue with the eSign provider"));
  })
);

router.post(
  "/:token/complete",
  signingLimiter,
  validate({ params: schemas.signerTokenParam }),
  asyncHandler(async (req, res) => {
    const result = await completeEsign({ token: req.params.token, transactionId: req.body?.transactionId, ...context(req) });
    res.json(new ApiResponse(result, "Signature recorded"));
  })
);

export default router;
