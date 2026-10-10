import { Router } from "express";
import {
  getPublicSigningSessionController,
  submitPublicSignatureController,
  declinePublicSigningController,
} from "../controllers/signing.controller.js";
import { validate, schemas } from "../middlewares/validate.middleware.js";
import { signingLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.use(signingLimiter);

// Public endpoints — the signer is identified by the token in the URL,
// and must also have passed any identity check the sender required
router.get("/:token", validate({ params: schemas.signerTokenParam }), getPublicSigningSessionController);
router.post(
  "/:token/sign",
  validate({ params: schemas.signerTokenParam, body: schemas.signSubmit }),
  submitPublicSignatureController
);
router.post(
  "/:token/decline",
  validate({ params: schemas.signerTokenParam, body: schemas.signDecline }),
  declinePublicSigningController
);

export default router;
