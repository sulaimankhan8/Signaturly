import { describe, it, expect } from "vitest";
import { makePdfBuffer } from "../helpers.js";
import { sealPdfBuffer, inspectSeal, generateSelfSignedP12 } from "../../src/services/pdfSeal.service.js";
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
});
