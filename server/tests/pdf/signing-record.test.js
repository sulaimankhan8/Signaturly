import { describe, it, expect } from "vitest";
import fs from "fs";
import { createUser, sendDocument, signAs, flushEvents, reloadPdf } from "../helpers.js";
import { renderPdfPage } from "../render.js";
import { generateAuditCertificatePdf, recordLanguageOf } from "../../src/services/auditCertificate.service.js";
import { inspectSeal } from "../../src/services/pdfSeal.service.js";
import { readFile } from "../../src/services/storage.service.js";
import { own, messageKeys } from "../../src/i18n/messages.js";

// Ink in a strip of the page, in page points measured from the top-left corner
const inkIn = (canvas, scale, { left, right, top = 0, bottom = Infinity }) => {
  const x0 = Math.floor(left * scale);
  const y0 = Math.floor(top * scale);
  const width = Math.floor(right * scale) - x0;
  const height = Math.min(canvas.height, Math.floor(bottom * scale)) - y0;
  const { data } = canvas.getContext("2d").getImageData(x0, y0, width, height);
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] < 384) ink += 1;
  }
  return ink;
};

const completeFor = async (recipient) => {
  const sender = await createUser();
  const sent = await sendDocument(sender, [recipient]);
  const res = await signAs(sent.recipients[0].token, ["sig-1"]);
  expect(res.status).toBe(200);
  await flushEvents();
  return { sender, ...sent, pdf: await reloadPdf(sent.pdfId) };
};

// Plan task P3-04: a signer who was sent the document in Hindi gets a record they can follow.
describe("P3-04 the signing record follows the signers' language", () => {
  it("stays in English alone when every signer reads English", () => {
    expect(recordLanguageOf([{ language: "en" }, { language: "en" }])).toBeNull();
    expect(recordLanguageOf([{}, { language: undefined }])).toBeNull();
    expect(recordLanguageOf([])).toBeNull();
  });

  it("adds the language most signers read", () => {
    expect(recordLanguageOf([{ language: "en" }, { language: "hi" }])).toBe("hi");
    expect(recordLanguageOf([{ language: "hi" }, { language: "hi" }, { language: "en" }])).toBe("hi");
  });

  it("does not add a language whose wording has not been written yet", () => {
    // Tamil is accepted for signers but has no translations yet
    expect(own("ta", "record.title.pending")).toBeUndefined();
    expect(recordLanguageOf([{ language: "ta" }])).toBeNull();
    expect(recordLanguageOf([{ language: "ta" }, { language: "ta" }, { language: "hi" }])).toBe("hi");
  });

  it("has Hindi wording for every heading and label of the record", () => {
    const recordKeys = messageKeys().filter((key) => key.startsWith("record."));
    expect(recordKeys.length).toBeGreaterThan(30);
    for (const key of recordKeys) expect(own("hi", key), key).toBeTruthy();
  });

  it("prints headings and labels in both languages for a Hindi signer, and once for an English signer", async () => {
    const english = await completeFor({ name: "Asha Rao", email: "asha.en@example.test", language: "en" });
    const hindi = await completeFor({ name: "आशा राव", email: "asha.hi@example.test", language: "hi" });

    const englishRecord = await generateAuditCertificatePdf(english.pdfId, english.sender.id);
    const hindiRecord = await generateAuditCertificatePdf(hindi.pdfId, hindi.sender.id);

    const scale = 2;
    const { canvas: englishPage } = await renderPdfPage(englishRecord, 1, scale);
    const { canvas: hindiPage } = await renderPdfPage(hindiRecord, 1, scale);

    if (process.env.SAVE_RENDERS) {
      fs.writeFileSync(`${process.env.SAVE_RENDERS}/record-en.png`, englishPage.toBuffer("image/png"));
      fs.writeFileSync(`${process.env.SAVE_RENDERS}/record-hi.png`, hindiPage.toBuffer("image/png"));
    }

    // The label column (left 120 points inside the margin) carries a second line of labels
    const labels = { left: 40, right: 158, top: 110 };
    expect(inkIn(hindiPage, scale, labels)).toBeGreaterThan(inkIn(englishPage, scale, labels) * 1.2);

    // Nothing is drawn outside the page margins, where a printer would cut it off
    for (const page of [englishPage, hindiPage]) {
      expect(inkIn(page, scale, { left: 0, right: 30 })).toBe(0);
      expect(inkIn(page, scale, { left: 590, right: 612 })).toBe(0);
    }
  });

  it("seals a Hindi signer's document with its bilingual record attached", async () => {
    const { pdf } = await completeFor({ name: "आशा राव", email: "asha.seal@example.test", language: "hi" });
    expect(pdf.sealedKey).toBeTruthy();

    const seal = inspectSeal(await readFile(pdf.sealedKey));
    expect(seal).toMatchObject({ present: true, intact: true, issuedByThisService: true });
  });
});
