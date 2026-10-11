import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { api, createUser, makePdfBuffer, signatureField, signAs, flushEvents } from "../helpers.js";
import { pdfText } from "../render.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { readFile } from "../../src/services/storage.service.js";
import { originalKeyOf } from "../../src/services/documentFiles.service.js";

// Plan task P5-10: several papers go to a signer as one document and are signed in one sitting.
// They are joined into a single PDF when they are uploaded.

const part = async (pages, filename) => ["pdfs", await makePdfBuffer(pages), { filename, contentType: "application/pdf" }];
const join = (account, parts) => parts.reduce((call, one) => call.attach(...one), api().post("/api/pdf/upload-joined").set(account.auth));

describe("P5-10 several PDFs joined into one document", () => {
  it("joins them in the order sent, as one document of all their pages", async () => {
    const user = await createUser();
    const res = await join(user, [await part(2, "Offer letter.pdf"), await part(1, "Leave policy.pdf"), await part(3, "Nomination form.pdf")]);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ pageCount: 6, originalFileName: "Offer letter and 2 more.pdf" });
    expect(await Pdf.countDocuments({ userId: user.id })).toBe(1);

    const stored = await readFile(originalKeyOf(await Pdf.findById(res.body.data.id)));
    expect((await PDFDocument.load(stored)).getPageCount()).toBe(6);
    // Each file's own pages keep their order: page 1 of the second file follows page 2 of the first
    const pages = await pdfText(stored);
    expect(pages.map((text) => text.trim())).toEqual(["Test agreement page 1", "Test agreement page 2", "Test agreement page 1", "Test agreement page 1", "Test agreement page 2", "Test agreement page 3"]);
  });

  it("is sent and signed as one document, counted once", async () => {
    const user = await createUser();
    const joined = await join(user, [await part(1, "a.pdf"), await part(1, "b.pdf")]);
    const sent = await api()
      .post(`/api/send/${joined.body.data.id}`)
      .set(user.auth)
      .send({ recipients: [{ name: "Asha Rao", email: "asha@example.test" }], fields: [signatureField("on-first", "asha@example.test"), signatureField("on-second", "asha@example.test", { page: 2 })] });
    expect(sent.status).toBe(200);
    await flushEvents();

    const recipient = await Recipient.findOne({ pdfId: joined.body.data.id });
    // One field left empty: nothing is signed
    expect((await signAs(recipient.token, ["on-first"])).status).toBe(422);
    expect((await signAs(recipient.token, ["on-first", "on-second"])).status).toBe(200);
    expect((await Pdf.findById(joined.body.data.id)).status).toBe("signed");
    expect((await api().get("/api/billing/subscription").set(user.auth)).body.data.usage.usedThisMonth).toBe(1);
  });

  it("refuses a file that is not a PDF, a single file, and more files than it joins", async () => {
    const user = await createUser();
    const notPdf = ["pdfs", Buffer.from("just some text"), { filename: "notes.pdf", contentType: "application/pdf" }];
    const mixed = await join(user, [await part(1, "a.pdf"), notPdf]);
    expect(mixed.status).toBe(422);
    expect(mixed.body.message).toContain("notes.pdf");

    expect((await join(user, [await part(1, "only.pdf")])).status).toBe(400);

    const many = [];
    for (let i = 0; i < 11; i++) many.push(await part(1, `f${i}.pdf`));
    expect((await join(user, many)).status).toBeGreaterThanOrEqual(400);
    expect(await Pdf.countDocuments({ userId: user.id })).toBe(0);
  });

  it("refuses a joined document of more than 500 pages", async () => {
    const user = await createUser();
    const res = await join(user, [await part(300, "long.pdf"), await part(201, "longer.pdf")]);
    expect(res.status).toBe(422);
    expect(await Pdf.countDocuments({ userId: user.id })).toBe(0);
  });
});
