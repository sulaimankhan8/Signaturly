import fs from "fs";
import path from "path";
import { env } from "../config/env.js";
import { buildSignedFileUrl } from "../utils/fileUrl.js";

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

const uploadsRoot = () => path.resolve(env.uploadsDir);

/**
 * Turns a stored path (relative key, absolute local path, or gs:// URI) into a safe relative key.
 * Throws on anything that could escape the storage root.
 */
export const normalizeKey = (input) => {
  if (typeof input !== "string" || !input || input.includes("\0")) {
    throw new Error("Invalid storage key");
  }

  let key = input.replace(/\\/g, "/");

  const gcsPrefix = `gs://${env.gcsBucketName}/`;
  const rootPrefix = `${uploadsRoot().replace(/\\/g, "/")}/`;
  if (key.startsWith(gcsPrefix)) {
    key = key.substring(gcsPrefix.length);
  } else if (key.startsWith(rootPrefix)) {
    key = key.substring(rootPrefix.length);
  } else if (key.includes("uploads/")) {
    key = key.substring(key.indexOf("uploads/") + 8);
  }

  key = key.replace(/^\/+/, "");

  const segments = key.split("/");
  if (
    !key ||
    /^[a-zA-Z]:/.test(key) ||
    key.includes("://") ||
    segments.some((s) => s === "" || s === "." || s === "..")
  ) {
    throw new Error("Invalid storage key");
  }

  return key;
};

const localPathFor = (key) => {
  const root = uploadsRoot();
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
};

/**
 * Save file buffer to GCS or local disk
 * @param {string} relativePath - Relative path/key e.g. "userId/filename.pdf"
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type e.g. "application/pdf"
 */
export const saveFile = async (relativePath, buffer, mimeType = "application/pdf") => {
  const normalizedKey = normalizeKey(relativePath);

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
    const localPath = localPathFor(normalizedKey);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, buffer);
    return localPath;
  }
};

/**
 * Read file buffer from GCS or local disk
 * @param {string} relativePath - Relative path/key e.g. "userId/filename.pdf" or full storagePath
 */
export const readFile = async (relativePath) => {
  const normalizedKey = normalizeKey(relativePath);

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
    return await fs.promises.readFile(localPathFor(normalizedKey));
  }
};

/**
 * Check if file exists in GCS or local disk
 * @param {string} relativePath - Relative path/key
 */
export const fileExists = async (relativePath) => {
  let normalizedKey;
  try {
    normalizedKey = normalizeKey(relativePath);
  } catch {
    return false;
  }

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
    try {
      const stat = await fs.promises.stat(localPathFor(normalizedKey));
      return stat.isFile();
    } catch {
      return false;
    }
  }
};

/**
 * Delete file from GCS or local disk
 * @param {string} relativePath - Relative path/key
 */
export const deleteFile = async (relativePath) => {
  let normalizedKey;
  try {
    normalizedKey = normalizeKey(relativePath);
  } catch {
    return;
  }

  if (env.storageProvider === "gcs") {
    try {
      const bucket = await getGcsBucket();
      const file = bucket.file(normalizedKey);
      await file.delete({ ignoreNotFound: true });
    } catch (e) {
      console.warn("GCS delete warning:", e.message);
    }
  } else {
    try {
      await fs.promises.unlink(localPathFor(normalizedKey));
    } catch (e) {
      if (e.code !== "ENOENT") console.warn("Local delete warning:", e.message);
    }
  }
};

/**
 * Generate a short-lived download link for the client.
 * Always a signed /uploads link, so the API checks every read whatever the storage provider.
 * @param {string} relativePath - Relative path/key
 */
export const getFileUrl = async (relativePath, ttlSeconds) => {
  return buildSignedFileUrl(normalizeKey(relativePath), ttlSeconds);
};
