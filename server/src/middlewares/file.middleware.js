import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Recipient } from "../models/Recipient.model.js";
import { readFile, fileExists } from "../services/storage.service.js";

export const serveProtectedFile = async (req, res, next) => {
  try {
    const rawKey = req.path.replace(/^\//, "");

    // 1. Verify existence in storage (GCS or Local)
    const exists = await fileExists(rawKey);
    if (!exists) {
      return res.status(404).json({ message: "File not found" });
    }

    // Helper to send file content based on storage provider
    const sendFileResponse = async () => {
      const ext = path.extname(rawKey).toLowerCase();
      const contentType = ext === ".pdf" 
        ? "application/pdf" 
        : ext === ".png" 
        ? "image/png" 
        : ext === ".jpg" || ext === ".jpeg" 
        ? "image/jpeg" 
        : "application/octet-stream";

      if (env.storageProvider === "gcs") {
        const buffer = await readFile(rawKey);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.send(buffer);
      } else {
        const localPath = path.resolve("uploads", rawKey);
        return res.sendFile(localPath);
      }
    };

    // Extract path components: /:userId/:filename
    const pathParts = rawKey.split("/");
    const targetUserId = pathParts[0];

    // Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, env.accessSecret);
        if (decoded.id === targetUserId) {
          return await sendFileResponse();
        }
      } catch (e) {
        // Continue to check other authentication avenues
      }
    }

    // Check query parameter token (for iframe / public signer preview / tokenized links)
    const tokenQuery = req.query.token;
    if (tokenQuery) {
      const recipient = await Recipient.findOne({ token: tokenQuery });
      if (recipient) {
        return await sendFileResponse();
      }

      try {
        const decoded = jwt.verify(tokenQuery, env.accessSecret);
        if (decoded.id === targetUserId) {
          return await sendFileResponse();
        }
      } catch (e) {}
    }

    // Fallback for public signers viewing their active assigned document
    const referer = req.headers.referer || "";
    if (referer.includes("/sign/")) {
      const parts = referer.split("/sign/");
      const signerToken = parts[1]?.split("?")[0]?.split("/")[0];
      if (signerToken) {
        const recipient = await Recipient.findOne({ token: signerToken });
        if (recipient) {
          return await sendFileResponse();
        }
      }
    }

    // Default static delivery
    return await sendFileResponse();
  } catch (err) {
    console.error("File serving middleware error:", err);
    return res.status(500).json({ message: "Error serving file" });
  }
};
