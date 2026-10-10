import path from "path";
import { fileExists } from "./storage.service.js";

const baseKeyOf = (pdf) => {
  const fileName = path.basename(String(pdf.storagePath).split("\\").join("/"));
  return `${pdf.userId?._id || pdf.userId}/${fileName}`;
};

// The untouched upload
export const originalKeyOf = (pdf) => baseKeyOf(pdf);

// Before versions existed, every signature overwrote one "-signed.pdf" file
const legacySignedKeyOf = (pdf) => baseKeyOf(pdf).replace(/\.pdf$/i, "-signed.pdf");

export const nextVersionKeyOf = (pdf) =>
  baseKeyOf(pdf).replace(/\.pdf$/i, `-v${(pdf.versions?.length || 0) + 1}.pdf`);

export const sealedKeyFor = (pdf) => baseKeyOf(pdf).replace(/\.pdf$/i, "-sealed.pdf");

/**
 * The latest working copy: the newest stamped version, or the original if nothing is stamped yet.
 * Stamping always continues from here, never from the sealed copy.
 */
export const currentKeyOf = async (pdf) => {
  if (pdf.versions?.length > 0) {
    return pdf.versions[pdf.versions.length - 1].key;
  }
  const legacy = legacySignedKeyOf(pdf);
  return (await fileExists(legacy)) ? legacy : originalKeyOf(pdf);
};

// What a person should receive when they ask for "the document"
export const downloadKeyOf = async (pdf) => pdf.sealedKey || (await currentKeyOf(pdf));

export const hasSignedCopy = async (pdf) =>
  Boolean(pdf.sealedKey) || pdf.versions?.length > 0 || (await fileExists(legacySignedKeyOf(pdf)));
