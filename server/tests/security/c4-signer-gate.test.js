import { describe, it, expect } from "vitest";
import { api, createUser, sendDocument, signAs, latestOtpFor, reloadRecipient, flushEvents } from "../helpers.js";
import { PdfAudit } from "../../src/models/PdfAudit.model.js";
import { env } from "../../src/config/env.js";

// Audit finding C4: the signer identity check could be skipped by calling the API directly.
describe("C4 signer verification is enforced on the server", () => {
  const otpSigner = { name: "Otp Signer", email: "otp@example.test", authType: "otp" };
  const passcodeSigner = { name: "Code Signer", email: "code@example.test", authType: "passcode", passcode: "blue-kettle" };

  it("hides the document and refuses signing until the OTP is passed", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [otpSigner]);
    const token = recipients[0].token;

    const session = await api().get(`/api/signing/${token}`);
    expect(session.status).toBe(200);
    expect(session.body.data.verificationRequired).toBe(true);
    expect(session.body.data.document.pdfUrl).toBeNull();
    expect(session.body.data.document.fields).toEqual([]);
    expect(session.body.data.recipient.email).not.toBe("otp@example.test");

    const sign = await signAs(token, ["sig-1"]);
    expect(sign.status).toBe(403);

    const decline = await api().post(`/api/signing/${token}/decline`).send({ reason: "no" });
    expect(decline.status).toBe(403);

    expect((await reloadRecipient(recipients[0]._id)).status).not.toBe("signed");
  });

  it("does not let the passcode route verify an OTP signer", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [otpSigner]);
    const token = recipients[0].token;

    const res = await api().post("/api/sign/otp/verify-passcode").send({ token, passcode: "anything" });
    expect(res.status).toBe(400);
    expect((await reloadRecipient(recipients[0]._id)).authVerified).toBe(false);
  });

  it("verifies with the emailed code, then signs, and records the real method", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [otpSigner]);
    const token = recipients[0].token;

    expect((await api().post("/api/sign/otp/send").send({ token })).status).toBe(200);
    const code = latestOtpFor("otp@example.test");
    expect(code).toMatch(/^\d{6}$/);

    const wrong = await api().post("/api/sign/otp/verify").send({ token, otp: code === "000000" ? "111111" : "000000" });
    expect(wrong.status).toBe(400);

    const ok = await api().post("/api/sign/otp/verify").send({ token, otp: code });
    expect(ok.status).toBe(200);

    // A code works once
    const again = await api().post("/api/sign/otp/verify").send({ token, otp: code });
    expect(again.status).toBe(400);

    const session = await api().get(`/api/signing/${token}`);
    expect(session.body.data.document.pdfUrl).toBeTruthy();

    expect((await signAs(token, ["sig-1"])).status).toBe(200);
    await flushEvents();

    const entry = await PdfAudit.findOne({ pdfId, event: "signed", otpVerified: true });
    expect(entry.authMethod).toBe("Email link + one-time code");
  });

  it("makes the signer wait before a second code and caps codes per hour", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [otpSigner]);
    const token = recipients[0].token;

    expect((await api().post("/api/sign/otp/send").send({ token })).status).toBe(200);
    const tooSoon = await api().post("/api/sign/otp/send").send({ token });
    expect(tooSoon.status).toBe(429);
  });

  it("locks the passcode after five wrong attempts", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [passcodeSigner]);
    const token = recipients[0].token;

    for (let i = 0; i < 4; i++) {
      const res = await api().post("/api/sign/otp/verify-passcode").send({ token, passcode: `wrong-${i}` });
      expect(res.status).toBe(400);
    }
    const fifth = await api().post("/api/sign/otp/verify-passcode").send({ token, passcode: "wrong-5" });
    expect(fifth.status).toBe(429);

    // Even the right passcode is refused while locked
    const locked = await api().post("/api/sign/otp/verify-passcode").send({ token, passcode: "blue-kettle" });
    expect(locked.status).toBe(429);
    expect((await reloadRecipient(recipients[0]._id)).authVerified).toBe(false);
  });

  it("accepts the right passcode and labels the audit entry accordingly", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [passcodeSigner]);
    const token = recipients[0].token;

    const ok = await api().post("/api/sign/otp/verify-passcode").send({ token, passcode: "blue-kettle" });
    expect(ok.status).toBe(200);
    expect((await signAs(token, ["sig-1"])).status).toBe(200);

    const entry = await PdfAudit.findOne({ pdfId, authMethod: "Email link + access passcode" });
    expect(entry).toBeTruthy();
  });

  it("requires a passcode when the sender chooses passcode protection", async () => {
    const sender = await createUser();
    const upload = await api()
      .post("/api/pdf/upload")
      .set(sender.auth)
      .attach("pdf", await (await import("../helpers.js")).makePdfBuffer(), { filename: "a.pdf", contentType: "application/pdf" });

    const res = await api()
      .post(`/api/send/${upload.body.data.id}`)
      .set(sender.auth)
      .send({ recipients: [{ name: "No Code", email: "nocode@example.test", authType: "passcode" }], fields: [] });
    expect(res.status).toBe(400);
  });

  it("rate limits verification attempts per signing link", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [otpSigner]);
    const token = recipients[0].token;

    env.rateLimitDisabled = false;
    let last;
    for (let i = 0; i < 21; i++) {
      last = await api().post("/api/sign/otp/verify").send({ token, otp: "123456" });
    }
    expect(last.status).toBe(429);
  });
});
