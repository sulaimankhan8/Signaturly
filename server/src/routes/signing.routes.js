import { Router } from "express";
import {
  getPublicSigningSessionController,
  submitPublicSignatureController,
  declinePublicSigningController,
} from "../controllers/signing.controller.js";

const router = Router();

// Public endpoints — authenticated via token in URL parameter
router.get("/:token", getPublicSigningSessionController);
router.post("/:token/sign", submitPublicSignatureController);
router.post("/:token/decline", declinePublicSigningController);

export default router;
