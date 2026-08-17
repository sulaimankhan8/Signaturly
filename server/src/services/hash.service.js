import crypto from "crypto";
import fs from "fs";

export const sha256FromBuffer = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

export const calculateFileHash = async (filePath) => {
  const fileBuffer = await fs.promises.readFile(filePath);
  return sha256FromBuffer(fileBuffer);
};