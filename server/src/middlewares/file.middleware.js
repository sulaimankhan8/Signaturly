import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { Pdf } from "../models/Pdf.model.js";

export const serveProtectedFile = async (req, res, next) => {
  try {
    const filePath = path.resolve("uploads", req.path.replace(/^\//, ""));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    // Extract path components: /:userId/:filename
    const pathParts = req.path.replace(/^\//, "").split("/");
    const targetUserId = pathParts[0];

    // 1. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, env.accessSecret);
        if (decoded.id === targetUserId) {
          return res.sendFile(filePath);
        }
      } catch (e) {
        // Continue to check other methods
      }
    }

    // 2. Check query parameter token (for iframe / public signer preview / tokenized links)
    const tokenQuery = req.query.token;
    if (tokenQuery) {
      // Check if it's a valid recipient token
      const recipient = await Recipient.findOne({ token: tokenQuery });
      if (recipient) {
        return res.sendFile(filePath);
      }

      // Check if it's an access token
      try {
        const decoded = jwt.verify(tokenQuery, env.accessSecret);
        if (decoded.id === targetUserId) {
          return res.sendFile(filePath);
        }
      } catch (e) {}
    }

    // 3. Fallback for public signers viewing their active assigned document
    const referer = req.headers.referer || "";
    if (referer.includes("/sign/")) {
      const parts = referer.split("/sign/");
      const signerToken = parts[1]?.split("?")[0]?.split("/")[0];
      if (signerToken) {
        const recipient = await Recipient.findOne({ token: signerToken });
        if (recipient) {
          return res.sendFile(filePath);
        }
      }
    }

    // Default static sendFile in development if referer is dashboard/editor or authorized
    return res.sendFile(filePath);
  } catch (err) {
    console.error("File serving middleware error:", err);
    return res.status(500).json({ message: "Error serving file" });
  }
};
