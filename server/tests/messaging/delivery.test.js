import { describe, it, expect, beforeEach } from "vitest";
import { api, createUser, uploadPdf, flushEvents, emailsTo, PNG_DATA_URL, reloadRecipient } from "../helpers.js";
import { messageOutbox, normalizePhone, maskPhone } from "../../src/services/messaging/index.js";
import { emailOutbox } from "../../src/config/email.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { PdfAudit } from "../../src/models/PdfAudit.model.js";
import { env } from "../../src/config/env.js";
import { t, messageKeys, languagesWith, normalizeLanguage } from "../../src/i18n/messages.js";
import { sendManualRecipientReminder } from "../../src/services/reminder.service.js";

const field = (id, extra) => ({
  id,
  type: "signature",
  page: 1,
  xPercent: 0.1,
  yPercent: 0.8,
  widthPercent: 0.25,
  heightPercent: 0.06,
  ...extra,
});

const send = async (account, recipients, fields) => {
  const doc = await uploadPdf(account);
  const res = await api().post(`/api/send/${doc.id}`).set(account.auth).send({ recipients, fields });
  await flushEvents();
  return { res, pdfId: doc.id, stored: await Recipient.find({ pdfId: doc.id }).sort({ signingOrder: 1 }) };
};

const sign = (token, ids) =>
  api().post(`/api/signing/${token}/sign`).send({ consent: true, fields: ids.map((id) => ({ id, signatureUrl: PNG_DATA_URL })) });

beforeEach(() => {
  messageOutbox.length = 0;
  env.messagingEnabled = true;
});

describe("phone numbers", () => {
  it.each([
    ["+919876543210", "+919876543210"],
    ["9876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+971501234567", "+971501234567"],
    ["+819012345678", "+819012345678"],
  ])("reads %s as %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "abcdefghij", "+0123456789", "98765", null, undefined, 9876543210])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("masks a number for display", () => {
    expect(maskPhone("+919876543210")).toBe("+91******10");
  });
});

describe("signers reached by phone", () => {
  it("sends the link by WhatsApp to a signer with no email, who can then sign", async () => {
    const sender = await createUser();
    const { res, pdfId, stored } = await send(
      sender,
      [{ name: "Ravi Kumar", phone: "98765 43210", channel: "whatsapp" }],
      [field("sig-1", { recipientPhone: "9876543210" })]
    );

    expect(res.status).toBe(200);
    expect(stored[0]).toMatchObject({ phone: "+919876543210", channel: "whatsapp", email: "" });

    expect(messageOutbox).toHaveLength(1);
    expect(messageOutbox[0]).toMatchObject({ channel: "whatsapp", to: "+919876543210", template: "signing_request" });
    expect(messageOutbox[0].text).toContain(`/sign/${stored[0].token}`);
    expect(emailOutbox.filter((m) => /Signature Requested/.test(m.subject))).toHaveLength(0);
    expect((await reloadRecipient(stored[0]._id)).delivery.status).toBe("sent");

    // The field was linked to this signer by phone number
    const session = await api().get(`/api/signing/${stored[0].token}`);
    expect(session.body.data.document.fields[0].recipientId).toBe(stored[0]._id.toString());
    expect(session.body.data.recipient.phone).toBe("+91******10");

    expect((await sign(stored[0].token, ["sig-1"])).status).toBe(200);
    await flushEvents();

    const entry = await PdfAudit.findOne({ pdfId, event: "signed" });
    expect(entry.authMethod).toBe("WhatsApp link");
    expect(messageOutbox.some((m) => m.template === "completed" && m.to === "+919876543210")).toBe(true);
  });

  it("sends the one-time code by SMS and records that method", async () => {
    const sender = await createUser();
    const { pdfId, stored } = await send(
      sender,
      [{ name: "Ravi Kumar", phone: "+919876543210", channel: "sms", authType: "otp" }],
      [field("sig-1", { recipientPhone: "+919876543210" })]
    );
    const token = stored[0].token;

    // Before verification, the session shows a masked number, never the full one
    const locked = await api().get(`/api/signing/${token}`);
    expect(locked.body.data.verificationRequired).toBe(true);
    expect(JSON.stringify(locked.body)).not.toContain("9876543210");

    expect((await api().post("/api/sign/otp/send").send({ token })).status).toBe(200);
    const sms = messageOutbox.find((m) => m.template === "otp");
    expect(sms).toMatchObject({ channel: "sms", to: "+919876543210" });
    expect(emailOutbox.filter((m) => /Verification Code/.test(m.subject))).toHaveLength(0);

    const res = await api().post("/api/sign/otp/verify").send({ token, otp: sms.params.code });
    expect(res.status).toBe(200);
    expect((await sign(token, ["sig-1"])).status).toBe(200);

    expect((await PdfAudit.findOne({ pdfId, event: "identity_verified" })).authMethod).toBe("sms_otp");
    const signed = await PdfAudit.findOne({ pdfId, event: "signed" });
    expect(signed.authMethod).toBe("SMS link + one-time code by SMS");
    expect(signed.otpVerified).toBe(true);
  });

  it("sends reminders the same way as the invitation", async () => {
    const sender = await createUser();
    const { stored } = await send(sender, [{ name: "Ravi", phone: "+919876543210", channel: "sms" }], []);
    messageOutbox.length = 0;

    await sendManualRecipientReminder({ recipientId: stored[0]._id, userId: sender.id });
    await flushEvents();

    expect(messageOutbox).toHaveLength(1);
    expect(messageOutbox[0]).toMatchObject({ channel: "sms", template: "reminder" });
  });

  it("refuses an unusable number, and a phone channel with no number", async () => {
    const sender = await createUser();
    const bad = await send(sender, [{ name: "Ravi", phone: "12345", channel: "sms" }], []);
    expect(bad.res.status).toBe(400);

    const missing = await send(sender, [{ name: "Ravi", email: "ravi@example.test", channel: "whatsapp" }], []);
    expect(missing.res.status).toBe(400);
    expect(messageOutbox).toHaveLength(0);
  });

  it("refuses phone delivery while messaging is switched off, and leaves email unaffected", async () => {
    env.messagingEnabled = false;
    const sender = await createUser();

    const viaSms = await send(sender, [{ name: "Ravi", phone: "+919876543210", channel: "sms" }], []);
    expect(viaSms.res.status).toBe(503);
    expect(viaSms.res.body.message).toContain("MESSAGING_UNAVAILABLE");
    expect(viaSms.stored).toHaveLength(0);

    const viaEmail = await send(sender, [{ name: "Asha", email: "asha@example.test" }], []);
    expect(viaEmail.res.status).toBe(200);
  });

  it("keeps a phone number on an email signer without changing how they are reached", async () => {
    const sender = await createUser();
    const { stored } = await send(sender, [{ name: "Asha", email: "asha@example.test", phone: "9876543210" }], []);

    expect(stored[0]).toMatchObject({ channel: "email", phone: "+919876543210" });
    expect(emailsTo("asha@example.test")).toHaveLength(1);
    expect(messageOutbox).toHaveLength(0);
  });
});

describe("signer language", () => {
  it("writes the invitation and the one-time code in the signer's language", async () => {
    const sender = await createUser();
    const { stored } = await send(
      sender,
      [{ name: "आशा राव", email: "asha@example.test", language: "hi", authType: "otp" }],
      [field("sig-1", { recipientEmail: "asha@example.test" })]
    );

    const invite = emailsTo("asha@example.test")[0];
    expect(invite.subject).toContain("हस्ताक्षर का अनुरोध");
    expect(invite.html).toContain('lang="hi"');
    expect(invite.html).toContain("दस्तावेज़ देखें और हस्ताक्षर करें");
    expect(invite.text).toContain(`/sign/${stored[0].token}`);

    await api().post("/api/sign/otp/send").send({ token: stored[0].token });
    const otpMail = emailsTo("asha@example.test").find((m) => /सत्यापन कोड/.test(m.subject));
    const code = /(\d{6})/.exec(otpMail.subject)[1];
    expect((await api().post("/api/sign/otp/verify").send({ token: stored[0].token, otp: code })).status).toBe(200);

    const session = await api().get(`/api/signing/${stored[0].token}`);
    expect(session.body.data.recipient.language).toBe("hi");
  });

  it("falls back to English for an unknown language", async () => {
    const sender = await createUser();
    const { stored } = await send(sender, [{ name: "Asha", email: "asha@example.test", language: "xx" }], []);
    expect(stored[0].language).toBe("en");
    expect(emailsTo("asha@example.test")[0].subject).toContain("Signature Requested");
  });

  it("escapes names and messages in every language", async () => {
    const sender = await createUser();
    const doc = await uploadPdf(sender);
    await api()
      .post(`/api/send/${doc.id}`)
      .set(sender.auth)
      .send({ recipients: [{ name: "Asha", email: "asha@example.test", language: "hi" }], fields: [], message: '<img src=x onerror="alert(1)">' });
    await flushEvents();

    const html = emailsTo("asha@example.test")[0].html;
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
});

describe("translations", () => {
  it("has English and Hindi wording for every message", () => {
    for (const key of messageKeys()) {
      expect(languagesWith(key), key).toEqual(expect.arrayContaining(["en", "hi"]));
    }
  });

  it("keeps every placeholder in the Hindi wording", () => {
    for (const key of messageKeys()) {
      const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(placeholders(t("hi", key)), key).toEqual(placeholders(t("en", key)));
    }
  });

  it("uses English for a language that has no wording yet", () => {
    expect(t("ta", "request.heading")).toBe(t("en", "request.heading"));
    expect(normalizeLanguage("TA")).toBe("ta");
    expect(normalizeLanguage("klingon")).toBe("en");
  });
});
