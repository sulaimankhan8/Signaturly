import { describe, it, expect } from "vitest";
import { makePdfBuffer } from "../helpers.js";
import { sealPdfBuffer, inspectSeal, generateSelfSignedP12, sliceDer, extractPdfSignature } from "../../src/services/pdfSeal.service.js";
import { PDFDocument } from "pdf-lib";
import signpdfModule from "@signpdf/signpdf";
import p12SignerModule from "@signpdf/signer-p12";
import placeholderModule from "@signpdf/placeholder-pdf-lib";

// Audit finding C7: signed PDFs carried no cryptographic signature.
describe("C7 the service certificate seals a PDF", () => {
  it("produces a file whose signature is present, intact and ours", async () => {
    const sealed = await sealPdfBuffer(await makePdfBuffer(2));
    const seal = inspectSeal(sealed);

    expect(seal.present).toBe(true);
    expect(seal.intact).toBe(true);
    expect(seal.issuedByThisService).toBe(true);
    expect(seal.signedAt).toBeInstanceOf(Date);

    // Still a readable PDF with the same pages
    expect((await PDFDocument.load(sealed)).getPageCount()).toBe(2);
  });

  it("detects a single changed byte", async () => {
    const sealed = await sealPdfBuffer(await makePdfBuffer());
    const tampered = Buffer.from(sealed);
    const index = tampered.indexOf("Test agreement") >= 0 ? tampered.indexOf("Test agreement") : 200;
    tampered[index] = tampered[index] === 0x41 ? 0x42 : 0x41;

    const seal = inspectSeal(tampered);
    expect(seal.present).toBe(true);
    expect(seal.intact).toBe(false);
  });

  it("detects content added after sealing", async () => {
    const sealed = await sealPdfBuffer(await makePdfBuffer());
    const appended = Buffer.concat([sealed, Buffer.from("\n% added later\n")]);
    expect(inspectSeal(appended).intact).toBe(false);
  });

  it("reports an unsealed PDF as having no signature", async () => {
    expect(inspectSeal(await makePdfBuffer()).present).toBe(false);
  });

  it("does not accept another party's certificate as ours", async () => {
    const signpdf = signpdfModule.default || signpdfModule;
    const password = "other";
    const foreign = generateSelfSignedP12({ commonName: "Somebody Else", password });

    const doc = await PDFDocument.load(await makePdfBuffer());
    placeholderModule.pdflibAddPlaceholder({ pdfDoc: doc, reason: "x", contactInfo: "x", name: "x", location: "x" });
    const signedElsewhere = await signpdf.sign(
      Buffer.from(await doc.save({ useObjectStreams: false })),
      new p12SignerModule.P12Signer(foreign, { passphrase: password })
    );

    const seal = inspectSeal(signedElsewhere);
    expect(seal.present).toBe(true);
    expect(seal.intact).toBe(true);
    expect(seal.issuedByThisService).toBe(false);
  });

  it("reads a signature that ends in zero bytes without cutting it short", () => {
    // A DER sequence of 5 content bytes ending in two zeros, followed by slot padding
    const der = Buffer.from([0x30, 0x05, 0x01, 0x02, 0x03, 0x00, 0x00]);
    const padded = Buffer.concat([der, Buffer.alloc(40)]);
    expect(sliceDer(padded)).toEqual(der);

    // Long-form length (0x82 = two length bytes)
    const long = Buffer.concat([Buffer.from([0x30, 0x82, 0x01, 0x00]), Buffer.alloc(256, 0x00)]);
    expect(sliceDer(Buffer.concat([long, Buffer.alloc(100)]))).toEqual(long);

    expect(sliceDer(Buffer.from([0x31, 0x00]))).toBeNull();
    expect(sliceDer(Buffer.from([0x30, 0x10, 0x01]))).toBeNull();
  });

  it("extracts a signature ending in zero bytes in full, where the library's helper cuts it short", async () => {
    // About 1 seal in 256 has a signature ending in a zero byte. The signing library's own
    // extractor strips trailing zeros, so a genuine sealed file was then reported as altered.
    const sealed = await sealPdfBuffer(await makePdfBuffer());
    const { ByteRange } = extractPdfSignature(sealed);
    const slotStart = ByteRange[0] + ByteRange[1] + 1;
    const slotLength = ByteRange[2] - 1 - slotStart;

    // Put a DER structure that ends in two zero bytes into the signature slot
    const der = Buffer.concat([Buffer.from([0x30, 0x82, 0x00, 0x08]), Buffer.from([1, 2, 3, 4, 5, 6, 0, 0])]);
    const crafted = Buffer.from(sealed);
    crafted.write(der.toString("hex").padEnd(slotLength, "0"), slotStart, "latin1");

    expect(Buffer.from(extractPdfSignature(crafted).signature, "binary")).toEqual(der);

    const utils = (await import("@signpdf/utils")).default;
    const fromLibrary = Buffer.from(utils.extractSignature(crafted).signature, "binary");
    expect(fromLibrary.length).toBeLessThan(der.length);
  });

  it("verifies many different seals", async () => {
    // Different content each time, so every signature is different
    for (let i = 0; i < 40; i++) {
      const sealed = await sealPdfBuffer(await makePdfBuffer(1 + (i % 3)), { reason: `Run ${i}` });
      expect(inspectSeal(sealed)).toMatchObject({ present: true, intact: true, issuedByThisService: true });
    }
  }, 120000);
});
