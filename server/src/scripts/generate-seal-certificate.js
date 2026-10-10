/**
 * Creates the certificate that seals completed documents and prints the two values to store as secrets.
 *
 *   node src/scripts/generate-seal-certificate.js --name="PactDoc" --org="Your Company"
 *
 * The certificate is self-signed: it proves a file is unchanged since sealing, but PDF readers
 * will show it as untrusted until it is replaced by one bought from a recognised authority.
 * Run this once per environment. Changing the certificate later means documents sealed with the
 * old one no longer show as "sealed by this service".
 */
import crypto from "crypto";
import { generateSelfSignedP12 } from "../services/pdfSeal.service.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  })
);

const password = crypto.randomBytes(24).toString("base64url");
const p12 = generateSelfSignedP12({
  commonName: args.name || "PactDoc Document Seal",
  organization: args.org || "PactDoc",
  password,
  years: Number(args.years) || 5,
});

console.log("Store these two values in your secret manager. They are shown once and saved nowhere.\n");
console.log(`SEAL_P12_PASSWORD=${password}\n`);
console.log(`SEAL_P12_BASE64=${p12.toString("base64")}`);
process.exit(0);
