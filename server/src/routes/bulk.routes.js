import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { bulkSendController } from "../controllers/bulk.controller.js";

const router = Router();

router.post("/send", protect, bulkSendController);

export default router;
