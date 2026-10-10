import crypto from "crypto";
import fs from "fs";
import path from "path";
import forge from "node-forge";
import signpdfModule from "@signpdf/signpdf";
import p12SignerModule from "@signpdf/signer-p12";
import placeholderModule from "@signpdf/placeholder-pdf-lib";
import { PDFDocument } from "pdf-lib";
import { env } from "../config/env.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { readFile, saveFile } from "./storage.service.js";
import { sha256FromBuffer } from "./hash.service.js";
import { currentKeyOf, sealedKeyFor } from "./documentFiles.service.js";
import { generateAuditCertificatePdf } from "./auditCertificate.service.js";
import { appendAuditEvent } from "./auditLedger.service.js";

const signpdf = signpdfModule.default || signpdfModule;
const { P12Signer } = p12SignerModule;
const { pdflibAddPlaceholder } = placeholderModule;

const DEV_P12_PASSWORD = "dev-only-seal";
const DEV_P12_FILE = ".dev-seal.p12";

/**
 * Creates a self-signed certificate and key as a PKCS#12 bundle.
 * A self-signed certificate proves a file is unchanged; PDF readers will still show it as
 * "not trusted" until a certificate from a recognised authority replaces it.
 */
export const generateSelfSignedP12 = ({ commonName, organization = "PactDoc", password, years = 5 }) => {
  const { privateKey: privatePem } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const privateKey = forge.pki.privateKeyFromPem(privatePem);
  const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);

  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = `01${crypto.randomBytes(8).toString("hex")}`;
  cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + years);

  const subject = [
    { name: "commonName", value: commonName },
    { name: "organizationName", value: organization },
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
  ]);
  cert.sign(privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], password, { algorithm: "3des" });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");
};

const fingerprintOfCertificate = (cert) =>
  crypto
    .createHash("sha256")
    .update(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary"))
    .digest("hex");

const readCertificateFromP12 = (p12Buffer, password) => {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Buffer.toString("binary")), password);
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (bags.length === 0) throw new Error("The seal certificate bundle contains no certificate");
  return bags[0].cert;
};

let cachedCredentials = null;

// Lets a rotated certificate take effect without a restart (and lets tests swap certificates)
export const resetSealCredentials = () => {
  cachedCredentials = null;
};

/**
 * The certificate that seals completed documents.
 * Production must provide one (SEAL_P12_BASE64). Elsewhere a self-signed one is created on first use.
 */
export const getSealCredentials = () => {
  if (cachedCredentials) return cachedCredentials;

  let p12Buffer;
  let password;

  if (env.sealP12Base64) {
    p12Buffer = Buffer.from(env.sealP12Base64, "base64");
    password = env.sealP12Password;
  } else if (env.isProd) {
    throw new Error("SEAL_P12_BASE64 is not configured");
  } else {
    password = DEV_P12_PASSWORD;
    const devFile = path.resolve(DEV_P12_FILE);
    if (!env.isTest && fs.existsSync(devFile)) {
      p12Buffer = fs.readFileSync(devFile);
    } else {
      p12Buffer = generateSelfSignedP12({ commonName: `${env.appName} (development seal)`, password });
      // Kept between restarts so documents sealed yesterday still verify today
      if (!env.isTest) fs.writeFileSync(devFile, p12Buffer);
    }
  }

  const certificate = readCertificateFromP12(p12Buffer, password);
  cachedCredentials = {
    p12Buffer,
    password,
    fingerprint: fingerprintOfCertificate(certificate),
    commonName: certificate.subject.getField("CN")?.value || "",
  };
  return cachedCredentials;
};

/**
 * Adds a certificate signature covering the whole file. Any later change to the bytes breaks it.
 */
export const sealPdfBuffer = async (buffer, { reason = "Document completed" } = {}) => {
  const { p12Buffer, password, commonName } = getSealCredentials();

  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  pdflibAddPlaceholder({
    pdfDoc,
    reason,
    contactInfo: env.smtpFrom || "",
    name: commonName || env.appName,
    location: env.appUrl,
    signingTime: new Date(),
    appName: env.appName,
  });

  // The signature library needs a classic cross-reference table
  const withPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  return await signpdf.sign(withPlaceholder, new P12Signer(p12Buffer, { passphrase: password }));
};

/**
 * Cuts a DER structure out of a buffer that may have padding after it, using the length the
 * structure itself declares. Returns null when the bytes are not a DER sequence.
 */
export const sliceDer = (bytes) => {
  if (bytes.length < 2 || bytes[0] !== 0x30) return null;

  let length = bytes[1];
  let header = 2;
  if (length & 0x80) {
    const lengthBytes = length & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4 || bytes.length < 2 + lengthBytes) return null;
    length = 0;
    for (let i = 0; i < lengthBytes; i++) length = length * 256 + bytes[2 + i];
    header = 2 + lengthBytes;
  }

  const total = header + length;
  return total <= bytes.length ? bytes.subarray(0, total) : null;
};

/**
 * Finds the last signature in a PDF: the bytes it covers and the signature itself.
 *
 * The signature sits in a fixed-size slot padded with zeros. Its real length is read from the
 * signature's own header. (The signing library's helper instead strips trailing zero bytes, which
 * cuts short any signature that happens to end in a zero: about one in 256.)
 */
export const extractPdfSignature = (buffer) => {
  const text = buffer.toString("latin1");
  const matches = [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
  if (matches.length === 0) return null;

  const ByteRange = matches[matches.length - 1].slice(1, 5).map(Number);
  const [start, firstLength, secondOffset, secondLength] = ByteRange;
  if (start + firstLength > buffer.length || secondOffset + secondLength > buffer.length || secondOffset <= start + firstLength) {
    return null;
  }

  const signedData = Buffer.concat([
    buffer.subarray(start, start + firstLength),
    buffer.subarray(secondOffset, secondOffset + secondLength),
  ]);

  // Between the two ranges: "<" + hex digits + ">"
  const hex = buffer.subarray(start + firstLength + 1, secondOffset - 1).toString("latin1").replace(/[^0-9a-fA-F]/g, "");
  const der = sliceDer(Buffer.from(hex, "hex"));

  return { ByteRange, signedData, signature: der ? der.toString("binary") : null };
};

/**
 * Inspects a PDF's certificate signature.
 * Returns whether one is present, whether the file is unchanged since it was applied,
 * and whether it was applied with this service's own certificate.
 */
export const inspectSeal = (buffer) => {
  const result = { present: false, intact: false, issuedByThisService: false, signerName: null, signedAt: null };

  const extracted = extractPdfSignature(buffer);
  if (!extracted) return result;
  result.present = true;

  if (!extracted.signature) {
    result.error = "The signature could not be read";
    return result;
  }

  try {
    const { signature, signedData, ByteRange } = extracted;
    const message = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(signature));
    const certificate = message.certificates[0];
    const attrs = message.rawCapture.authenticatedAttributes;

    // 1. The signed attributes must carry the digest of the bytes the signature covers
    const digestAttr = attrs.find(
      (attr) => forge.asn1.derToOid(attr.value[0].value) === forge.pki.oids.messageDigest
    );
    const expectedDigest = digestAttr.value[1].value[0].value;
    const actualDigest = crypto.createHash("sha256").update(signedData).digest().toString("binary");
    const digestMatches = expectedDigest === actualDigest;

    // 2. The signature over those attributes must verify with the signer's certificate
    const attrSet = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs);
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(Buffer.from(forge.asn1.toDer(attrSet).getBytes(), "binary"));
    const signatureValid = verifier.verify(
      forge.pki.certificateToPem(certificate),
      message.rawCapture.signature,
      "binary"
    );

    // 3. The signature must cover the whole file: nothing before it, nothing added after it
    const [start, , secondOffset, secondLength] = ByteRange;
    const coversWholeFile = start === 0 && secondOffset + secondLength === buffer.length;

    result.intact = digestMatches && signatureValid && coversWholeFile;
    result.signerName = certificate.subject.getField("CN")?.value || null;
    result.issuedByThisService = fingerprintOfCertificate(certificate) === getSealCredentials().fingerprint;

    const timeAttr = attrs.find((attr) => forge.asn1.derToOid(attr.value[0].value) === forge.pki.oids.signingTime);
    if (timeAttr) {
      const raw = timeAttr.value[1].value[0];
      result.signedAt =
        raw.type === forge.asn1.Type.UTCTIME ? forge.asn1.utcTimeToDate(raw.value) : forge.asn1.generalizedTimeToDate(raw.value);
    }
  } catch (err) {
    result.intact = false;
    result.error = "The signature could not be read";
  }

  return result;
};

/**
 * Produces the sealed copy of a document: the latest signed version, followed by its signing record,
 * signed as a whole with the service certificate. Callers must hold the document lock.
 */
export const sealDocument = async (pdfId) => {
  const pdf = await Pdf.findById(pdfId);
  if (!pdf) throw new ApiError(404, "Document not found");

  const workingKey = await currentKeyOf(pdf);
  const working = await readFile(workingKey);
  const workingHash = sha256FromBuffer(working);

  const record = await generateAuditCertificatePdf(pdfId, null, { finalHash: workingHash });

  const merged = await PDFDocument.load(working, { ignoreEncryption: true });
  const recordDoc = await PDFDocument.load(record);
  const recordPages = await merged.copyPages(recordDoc, recordDoc.getPageIndices());
  recordPages.forEach((p) => merged.addPage(p));
  merged.setProducer(env.appName);

  const sealed = await sealPdfBuffer(Buffer.from(await merged.save({ useObjectStreams: false })));
  const sealedHash = sha256FromBuffer(sealed);
  const sealedKey = sealedKeyFor(pdf);

  await saveFile(sealedKey, sealed, "application/pdf");
  await Pdf.updateOne({ _id: pdf._id }, { $set: { sealedKey, sealedHash, sealedAt: new Date() } });

  await appendAuditEvent({
    pdfId: pdf._id,
    userId: pdf.userId,
    event: "sealed",
    actorName: env.appName,
    originalHash: workingHash,
    signedHash: sealedHash,
    description: "Signing record attached and the file sealed with the service certificate.",
  });

  return { sealedKey, sealedHash, workingHash };
};
