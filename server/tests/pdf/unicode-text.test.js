import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { api, createUser, sendDocument, signAs, reloadPdf, PNG_DATA_URL, flushEvents } from "../helpers.js";
import { renderPdfPage, renderReferenceText, inkOverlap, inkPixels } from "../render.js";
import { shapeText, splitIntoRuns, drawShapedText, measureText } from "../../src/services/textShaping.service.js";
import { readFile } from "../../src/services/storage.service.js";
import { formatDate, formatEvidenceTime, formatMoney } from "../../src/utils/format.js";

const SCRIPTS = [
  ["Hindi", "श्री आशा राव क्षत्रिय ज्ञान प्रार्थना", "noto-sans-devanagari", "NotoSansDevanagari"],
  ["Tamil", "ஸ்ரீ தமிழ்நாடு ஒப்பந்தம் கையொப்பம்", "noto-sans-tamil", "NotoSansTamil"],
  ["Telugu", "శ్రీ తెలుగు ఒప్పందం క్షేత్రం", "noto-sans-telugu", "NotoSansTelugu"],
  ["Kannada", "ಶ್ರೀ ಕನ್ನಡ ಒಪ್ಪಂದ ಕ್ಷೇತ್ರ", "noto-sans-kannada", "NotoSansKannada"],
  ["Gujarati", "શ્રી ગુજરાતી કરાર ક્ષેત્ર", "noto-sans-gujarati", "NotoSansGujarati"],
  ["Bengali", "শ্রী বাংলা চুক্তি স্বাক্ষর ক্ষেত্র", "noto-sans-bengali", "NotoSansBengali"],
];

const pageWithText = async (draw) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 60]);
  await draw(page, doc);
  return Buffer.from(await doc.save());
};

// Audit finding M1: non-English text was deleted from signed PDFs.
// Decision record: docs/decisions/0001-text-rendering-for-indic-scripts.md
describe("M1 text in Indian scripts is drawn correctly", () => {
  it.each(SCRIPTS)("%s matches how a browser engine draws it", async (_name, text, fontPackage, filePrefix) => {
    const pdf = await pageWithText((page) => drawShapedText(page, text, { x: 10, y: 20, size: 20 }));
    const { canvas } = await renderPdfPage(pdf, 1, 2);

    const reference = renderReferenceText(text, {
      fontPackage,
      filePrefix,
      family: filePrefix,
      width: canvas.width,
      height: canvas.height,
      x: 20,
      baseline: canvas.height - 40,
      size: 40,
    });

    expect(inkOverlap(canvas, reference)).toBeGreaterThan(0.95);
  });

  it("shows why the PDF library's own text drawing is not used", async () => {
    // One glyph per character, no joining: far from the reference
    const [, text, fontPackage, filePrefix] = SCRIPTS[0];
    const shaped = await pageWithText((page) => drawShapedText(page, text, { x: 10, y: 20, size: 20 }));
    const plainLatin = await pageWithText(async (page, doc) => {
      page.drawText("Asha Rao", { x: 10, y: 20, size: 20, font: await doc.embedFont(StandardFonts.Helvetica) });
    });

    const reference = renderReferenceText(text, {
      fontPackage, filePrefix, family: filePrefix, width: 840, height: 120, x: 20, baseline: 80, size: 40,
    });
    expect(inkOverlap((await renderPdfPage(shaped)).canvas, reference)).toBeGreaterThan(0.95);
    expect(inkOverlap((await renderPdfPage(plainLatin)).canvas, reference)).toBeLessThan(0.7);
  });

  it("joins characters into conjuncts and finds a glyph for every character", () => {
    const conjunct = shapeText("क्षत्रिय");
    expect(conjunct.glyphs.length).toBeLessThan([..."क्षत्रिय"].length);
    expect(conjunct.missing).toBe(0);

    for (const [, text] of SCRIPTS) {
      expect(shapeText(text).missing, text).toBe(0);
    }
    expect(shapeText("Rent ₹12,000 per month").missing).toBe(0);
  });

  it("uses the right font for each part of mixed text", () => {
    expect(splitIntoRuns("Asha आशा राव, 2026 தமிழ்")).toEqual([
      { script: "latin", text: "Asha " },
      { script: "devanagari", text: "आशा राव, 2026 " },
      { script: "tamil", text: "தமிழ்" },
    ]);
  });

  it("shrinks long text to stay inside its field", async () => {
    const long = "यह एक बहुत लंबा नाम है जो खाने में नहीं आएगा";
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 60]);

    const fitted = drawShapedText(page, long, { x: 10, y: 20, size: 20, maxWidth: 150 });
    expect(fitted.size).toBeLessThan(20);
    expect(fitted.width).toBeLessThanOrEqual(150.01);
    expect(measureText(long, 20)).toBeGreaterThan(150);
  });
});

describe("M1 signing with non-English values", () => {
  const fields = [
    { id: "sig-1", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.8, widthPercent: 0.25, heightPercent: 0.06, recipientEmail: "asha@example.test" },
    { id: "name-1", type: "text", page: 1, xPercent: 0.1, yPercent: 0.5, widthPercent: 0.5, heightPercent: 0.05, recipientEmail: "asha@example.test" },
    { id: "date-1", type: "date", page: 1, xPercent: 0.1, yPercent: 0.6, widthPercent: 0.3, heightPercent: 0.05, required: false, recipientEmail: "asha@example.test" },
  ];

  it("keeps a Hindi name in the signed file and prints it on the signing record", async () => {
    const sender = await createUser();
    const sent = await sendDocument(sender, [{ name: "आशा राव", email: "asha@example.test" }], { fields });

    const res = await api()
      .post(`/api/signing/${sent.recipients[0].token}/sign`)
      .send({
        consent: true,
        fields: [
          { id: "sig-1", signatureUrl: PNG_DATA_URL },
          { id: "name-1", value: "आशा राव, मुंबई" },
        ],
      });
    expect(res.status).toBe(200);
    await flushEvents();

    const pdf = await reloadPdf(sent.pdfId);
    expect(pdf.fields.find((f) => f.id === "name-1").value).toBe("आशा राव, मुंबई");

    // The name field has ink where it was empty before
    const before = await renderPdfPage(await readFile(sent.upload.url.split("?")[0].replace("/uploads/", "")), 1, 1);
    const after = await renderPdfPage(await readFile(pdf.versions[0].key), 1, 1);
    const region = (canvas) => {
      const { width, height } = canvas;
      const crop = canvas.getContext("2d").getImageData(width * 0.1, height * 0.5, width * 0.5, height * 0.05);
      let ink = 0;
      for (let i = 0; i < crop.data.length; i += 4) if (crop.data[i] < 128) ink += 1;
      return ink;
    };
    expect(region(before.canvas)).toBe(0);
    expect(region(after.canvas)).toBeGreaterThan(100);

    // The signing record follows the document; it renders, and carries the name as drawn shapes
    const sealed = await readFile(pdf.sealedKey);
    const record = await renderPdfPage(sealed, pdf.pageCount + 1, 1);
    expect(inkPixels(record.canvas)).toBeGreaterThan(5000);
  });

  it("writes a default date that cannot be misread", () => {
    expect(formatDate(new Date("2026-03-04T10:00:00Z"))).toBe("04 Mar 2026");
  });
});

describe("India formats", () => {
  it("gives evidence times in UTC and India time", () => {
    expect(formatEvidenceTime(new Date("2026-10-11T08:35:09Z"))).toBe("2026-10-11 08:35:09 UTC (11 Oct 2026, 14:05:09 IST)");
    expect(formatEvidenceTime(null)).toBe("-");
  });

  it("groups rupee amounts the Indian way", () => {
    expect(formatMoney(120000)).toBe("₹1,20,000.00");
    expect(formatMoney(299)).toBe("₹299.00");
  });
});
