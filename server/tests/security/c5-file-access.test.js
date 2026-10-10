import { describe, it, expect } from "vitest";
import { api, createUser, uploadPdf, sendDocument } from "../helpers.js";
import { buildSignedFileUrl } from "../../src/utils/fileUrl.js";
import { normalizeKey } from "../../src/services/storage.service.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import path from "path";

const keyOf = async (pdfId) => {
  const pdf = await Pdf.findById(pdfId);
  return `${pdf.userId}/${path.basename(pdf.storagePath.replace(/\\/g, "/"))}`;
};

// Audit finding C5: every stored file was served to anyone who asked.
describe("C5 stored files are private", () => {
  it("refuses a file request that carries no proof of permission", async () => {
    const owner = await createUser();
    const doc = await uploadPdf(owner);
    const key = await keyOf(doc.id);

    expect((await api().get(`/uploads/${key}`)).status).toBe(403);
  });

  it("serves the owner by header token and refuses another user's token", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const doc = await uploadPdf(owner);
    const key = await keyOf(doc.id);

    expect((await api().get(`/uploads/${key}`).set(owner.auth)).status).toBe(200);
    expect((await api().get(`/uploads/${key}`).set(stranger.auth)).status).toBe(403);
  });

  it("does not accept a login token or a signer token in the URL", async () => {
    const owner = await createUser();
    const { pdfId, recipients } = await sendDocument(owner, [{ name: "Signer", email: "s@example.test" }]);
    const key = await keyOf(pdfId);

    expect((await api().get(`/uploads/${key}?token=${owner.token}`)).status).toBe(403);
    expect((await api().get(`/uploads/${key}?token=${recipients[0].token}`)).status).toBe(403);
    // The old rule trusted the Referer header
    expect((await api().get(`/uploads/${key}`).set("Referer", `http://localhost:5173/sign/${recipients[0].token}`)).status).toBe(403);
  });

  it("serves a signed link and refuses it once expired, altered or moved to another file", async () => {
    const owner = await createUser();
    const first = await uploadPdf(owner);
    const second = await uploadPdf(owner, { filename: "other.pdf" });
    const keyA = await keyOf(first.id);
    const keyB = await keyOf(second.id);

    const good = buildSignedFileUrl(keyA, 60);
    expect((await api().get(good)).status).toBe(200);

    const expired = buildSignedFileUrl(keyA, -10);
    expect((await api().get(expired)).status).toBe(403);

    const tampered = good.replace(/sig=[a-f0-9]{4}/, "sig=0000");
    expect((await api().get(tampered)).status).toBe(403);

    // A signature for one file does not open another
    const query = good.slice(good.indexOf("?"));
    expect((await api().get(`/uploads/${keyB}${query}`)).status).toBe(403);
  });

  it("returns links from the API that expire", async () => {
    const owner = await createUser();
    const doc = await uploadPdf(owner);
    expect(doc.url).toMatch(/\?exp=\d+&sig=[a-f0-9]{64}$/);

    const list = await api().get("/api/pdf/my-documents").set(owner.auth);
    expect(list.body.data[0].originalUrl).toMatch(/\?exp=\d+&sig=/);
  });

  it("rejects path traversal and absolute paths in storage keys", () => {
    for (const bad of ["../.env", "a/../../.env", "a/./b", "C:/Windows/win.ini", "a//b", "", "a\0b", "http://evil.test/x"]) {
      expect(() => normalizeKey(bad), bad).toThrow();
    }
    expect(normalizeKey("abc/file.pdf")).toBe("abc/file.pdf");
  });

  // Plan task P3-13: a phone on a slow connection fetches a long document in pieces
  it("serves part of a file on request, behind the same permission check", async () => {
    const owner = await createUser();
    const doc = await uploadPdf(owner);
    const key = await keyOf(doc.id);
    const link = buildSignedFileUrl(key, 60);

    const whole = await api().get(link).buffer(true).parse((res, done) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });
    expect(whole.status).toBe(200);
    expect(whole.headers["accept-ranges"]).toBe("bytes");

    const part = await api().get(link).set("Range", "bytes=0-7");
    expect(part.status).toBe(206);
    expect(part.headers["content-range"]).toBe(`bytes 0-7/${whole.body.length}`);
    expect(Buffer.from(part.body).toString("latin1")).toBe(whole.body.subarray(0, 8).toString("latin1"));
    expect(Buffer.from(part.body).toString("latin1")).toMatch(/^%PDF-/);

    expect((await api().get(link).set("Range", `bytes=${whole.body.length + 10}-`)).status).toBe(416);
    expect((await api().get(`/uploads/${key}`).set("Range", "bytes=0-7")).status).toBe(403);
  });

  it("answers traversal attempts over HTTP with an error, never a file", async () => {
    const res = await api().get("/uploads/..%2F..%2Fpackage.json");
    expect([400, 403, 404]).toContain(res.status);
    expect(res.text).not.toContain("dependencies");
  });
});
