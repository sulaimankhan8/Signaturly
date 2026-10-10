import path from "path";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { readFile, fileExists, normalizeKey } from "../services/storage.service.js";
import { verifySignedFileUrl } from "../utils/fileUrl.js";

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

// Keys look like "<userId>/<file>" or "templates/<userId>/<file>"
const ownerIdOfKey = (key) => {
  const parts = key.split("/");
  if (parts[0] === "templates") return parts[1] === "prebuilt" ? null : parts[1];
  return parts[0];
};

/**
 * Serves stored files. Denies by default: a request needs either a valid signed link
 * (issued by the API after its own permission check) or the owner's bearer token.
 */
export const serveProtectedFile = async (req, res) => {
  try {
    let key;
    try {
      key = normalizeKey(decodeURIComponent(req.path.replace(/^\//, "")));
    } catch {
      return res.status(400).json({ message: "Invalid file path" });
    }

    let allowed = false;

    const { exp, sig } = req.query;
    if (typeof exp === "string" && typeof sig === "string") {
      allowed = verifySignedFileUrl(key, exp, sig);
    }

    const authHeader = req.headers.authorization;
    if (!allowed && authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], env.accessSecret);
        const ownerId = ownerIdOfKey(key);
        allowed = Boolean(ownerId) && String(decoded.id) === ownerId;
      } catch {
        allowed = false;
      }
    }

    if (!allowed) {
      return res.status(403).json({ message: "Access to this file is not permitted" });
    }

    if (!(await fileExists(key))) {
      return res.status(404).json({ message: "File not found" });
    }

    const buffer = await readFile(key);
    const contentType = CONTENT_TYPES[path.extname(key).toLowerCase()] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    return res.send(buffer);
  } catch (err) {
    console.error("File serving middleware error:", err.message);
    return res.status(500).json({ message: "Error serving file" });
  }
};
