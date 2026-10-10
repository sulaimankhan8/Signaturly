import multer from "multer";

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 20 },
});
