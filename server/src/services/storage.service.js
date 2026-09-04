import fs from "fs";
import path from "path";
import { env } from "../config/env.js";

let gcsBucket = null;

// Lazy initialization of GCS Storage client
const getGcsBucket = async () => {
  if (gcsBucket) return gcsBucket;

  try {
    const { Storage } = await import("@google-cloud/storage");
    const storageOptions = {};
    if (env.gcpProjectId) {
      storageOptions.projectId = env.gcpProjectId;
    }
    const storage = new Storage(storageOptions);
    gcsBucket = storage.bucket(env.gcsBucketName);
    return gcsBucket;
  } catch (err) {
    console.error("Failed to initialize Google Cloud Storage client:", err);
    throw err;
  }
};

/**
 * Save file buffer to GCS or local disk
 * @param {string} relativePath - Relative path/key e.g. "userId/filename.pdf"
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type e.g. "application/pdf"
 */
export const saveFile = async (relativePath, buffer, mimeType = "application/pdf") => {
  // Normalize path
  const normalizedKey = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (env.storageProvider === "gcs") {
    const bucket = await getGcsBucket();
    const file = bucket.file(normalizedKey);
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
      resumable: false,
    });
    return `gs://${env.gcsBucketName}/${normalizedKey}`;
  } else {
    // Local filesystem storage
    const localPath = path.resolve("uploads", normalizedKey);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(localPath, buffer);
    return localPath;
  }
};

/**
 * Read file buffer from GCS or local disk
 * @param {string} relativePath - Relative path/key e.g. "userId/filename.pdf" or full storagePath
 */
export const readFile = async (relativePath) => {
  // Normalize key
  let normalizedKey = relativePath.replace(/\\/g, "/");
  if (normalizedKey.includes("uploads/")) {
    normalizedKey = normalizedKey.substring(normalizedKey.indexOf("uploads/") + 8);
  }
  normalizedKey = normalizedKey.replace(/^\/+/, "");

  if (env.storageProvider === "gcs") {
    const bucket = await getGcsBucket();
    const file = bucket.file(normalizedKey);
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found in GCS: ${normalizedKey}`);
    }
    const [buffer] = await file.download();
    return buffer;
  } else {
    // Local filesystem storage
    let localPath = path.resolve("uploads", normalizedKey);
    if (fs.existsSync(relativePath) && fs.statSync(relativePath).isFile()) {
      localPath = relativePath;
    }
    return await fs.promises.readFile(localPath);
  }
};

/**
 * Check if file exists in GCS or local disk
 * @param {string} relativePath - Relative path/key
 */
export const fileExists = async (relativePath) => {
  let normalizedKey = relativePath.replace(/\\/g, "/");
  if (normalizedKey.includes("uploads/")) {
    normalizedKey = normalizedKey.substring(normalizedKey.indexOf("uploads/") + 8);
  }
  normalizedKey = normalizedKey.replace(/^\/+/, "");

  if (env.storageProvider === "gcs") {
    try {
      const bucket = await getGcsBucket();
      const file = bucket.file(normalizedKey);
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  } else {
    const localPath = path.resolve("uploads", normalizedKey);
    return fs.existsSync(localPath) || (fs.existsSync(relativePath) && fs.statSync(relativePath).isFile());
  }
};

/**
 * Delete file from GCS or local disk
 * @param {string} relativePath - Relative path/key
 */
export const deleteFile = async (relativePath) => {
  let normalizedKey = relativePath.replace(/\\/g, "/");
  if (normalizedKey.includes("uploads/")) {
    normalizedKey = normalizedKey.substring(normalizedKey.indexOf("uploads/") + 8);
  }
  normalizedKey = normalizedKey.replace(/^\/+/, "");

  if (env.storageProvider === "gcs") {
    try {
      const bucket = await getGcsBucket();
      const file = bucket.file(normalizedKey);
      await file.delete({ ignoreNotFound: true });
    } catch (e) {
      console.warn("GCS delete warning:", e.message);
    }
  } else {
    const localPath = path.resolve("uploads", normalizedKey);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (e) {
        console.warn("Local delete warning:", e.message);
      }
    }
  }
};

/**
 * Generate secure download URL for client
 * @param {string} relativePath - Relative path/key
 */
export const getFileUrl = async (relativePath) => {
  let normalizedKey = relativePath.replace(/\\/g, "/");
  if (normalizedKey.includes("uploads/")) {
    normalizedKey = normalizedKey.substring(normalizedKey.indexOf("uploads/") + 8);
  }
  normalizedKey = normalizedKey.replace(/^\/+/, "");

  if (env.storageProvider === "gcs") {
    try {
      const bucket = await getGcsBucket();
      const file = bucket.file(normalizedKey);
      const expiresMs = Date.now() + (env.gcsSignedUrlExpires || 900) * 1000;
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: expiresMs,
      });
      return signedUrl;
    } catch (e) {
      console.error("GCS signed URL generation failed, falling back to proxy URL:", e);
      return `/uploads/${normalizedKey}`;
    }
  }

  return `/uploads/${normalizedKey}`;
};
