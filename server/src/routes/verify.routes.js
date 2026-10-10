import express from "express";
import multer from "multer";
import { verifyDocumentByBufferOrHash } from "../services/verification.service.js";
import { verifyLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

// POST /api/verify/document - Public document verification by PDF upload or SHA-256 hash string
router.post("/document", verifyLimiter, upload.single("file"), async (req, res) => {
  try {
    let result;

    if (req.file) {
      result = await verifyDocumentByBufferOrHash({ buffer: req.file.buffer });
    } else if (typeof req.body?.hash === "string" && /^[a-fA-F0-9]{64}$/.test(req.body.hash.trim())) {
      result = await verifyDocumentByBufferOrHash({ hash: req.body.hash.trim() });
    } else {
      return res.status(400).json({ error: "Please upload a PDF file or provide a 64-character SHA-256 hash." });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error verifying document:", error.message);
    return res.status(500).json({ error: "Failed to verify document integrity." });
  }
});

export default router;
