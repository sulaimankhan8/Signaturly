import multer from "multer";

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 20 },
});

// Several PDFs to be joined into one document. The size limit is for each file; the joined
// document is checked again as a whole.
export const MAX_FILES_TO_JOIN = 10;
export const uploadSeveral = multer({
  storage,
  limits: { fileSize: MAX_PDF_BYTES, files: MAX_FILES_TO_JOIN, fields: 20 },
});
