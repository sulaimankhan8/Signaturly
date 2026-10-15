import { describe, it, expect } from "vitest";
import { api, createUser, uploadPdf, sendDocument, PNG_DATA_URL, flushEvents, emailsTo } from "../helpers.js";
import { setPlan } from "../templates/fixtures.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { User } from "../../src/models/User.model.js";
import { fileExists } from "../../src/services/storage.service.js";
import { processAutomatedReminders } from "../../src/services/reminder.service.js";
import { emailOutbox } from "../../src/config/email.js";

const field = { id: "sig", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.7, widthPercent: 0.25, heightPercent: 0.06, recipientId: "client-1" };
const recipient = { id: "client-1", name: "Asha Rao", email: "asha@example.test", authType: "passcode", passcode: "secret-code" };

describe("the editor's work is saved as a draft", () => {
  it("comes back when the document is opened again, without passcodes or images", async () => {
    const owner = await createUser();
    const doc = await uploadPdf(owner);

    const saved = await api()
      .put(`/api/pdf/${doc.id}/draft`)
      .set(owner.auth)
      .send({
        mode: "send",
        recipients: [recipient],
        fields: [{ ...field, signatureUrl: PNG_DATA_URL }],
        settings: { message: "Please sign", reminderCadence: "3days", signingOrder: true },
      });
    expect(saved.status).toBe(200);

    const opened = await api().get(`/api/pdf/${doc.id}`).set(owner.auth);
    const { draft } = opened.body.data;
    expect(draft.mode).toBe("send");
    expect(draft.recipients[0]).toMatchObject({ id: "client-1", name: "Asha Rao", authType: "passcode" });
    expect(draft.recipients[0].passcode).toBeUndefined();
    expect(draft.fields[0]).toMatchObject({ id: "sig", recipientId: "client-1" });
    expect(draft.fields[0].signatureUrl).toBeUndefined();
    expect(draft.settings).toMatchObject({ message: "Please sign", reminderCadence: "3days", signingOrder: true });
  });

  it("is cleared by sending, after which it cannot be changed", async () => {
    const owner = await createUser();
    const { pdfId } = await sendDocument(owner, [{ name: "Asha Rao", email: "asha@example.test" }]);

    expect((await Pdf.findById(pdfId)).draft).toBeNull();
    const late = await api().put(`/api/pdf/${pdfId}/draft`).set(owner.auth).send({ mode: "send", fields: [] });
    expect(late.status).toBe(409);
    expect((await api().get(`/api/pdf/${pdfId}`).set(owner.auth)).body.data.draft).toBeNull();
  });

  it("is someone else's to change only if they may send it", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const doc = await uploadPdf(owner);
    const res = await api().put(`/api/pdf/${doc.id}/draft`).set(stranger.auth).send({ mode: "self", fields: [] });
    expect([403, 404]).toContain(res.status);
  });
});

describe("the signature saved with the account", () => {
  it("is saved, read back and removed", async () => {
    const user = await createUser();

    expect((await api().put("/api/user/signature").set(user.auth).send({ kind: "signature", dataUrl: PNG_DATA_URL })).status).toBe(200);
    const read = await api().get("/api/user/signature").set(user.auth);
    expect(read.body.data.signature).toMatch(/^data:image\/png;base64,/);
    expect(read.body.data.initials).toBeNull();

    const key = (await User.findById(user.id)).savedSignature.signatureKey;
    expect(key.startsWith(`${user.id}/signatures/`)).toBe(true);

    expect((await api().delete("/api/user/signature").query({ kind: "signature" }).set(user.auth)).status).toBe(200);
    expect((await api().get("/api/user/signature").set(user.auth)).body.data.signature).toBeNull();
    expect(await fileExists(key)).toBe(false);
  });

  it("takes only PNG or JPEG images, of a kind it knows", async () => {
    const user = await createUser();
    expect((await api().put("/api/user/signature").set(user.auth).send({ kind: "signature", dataUrl: "data:text/html;base64,PGgxPg==" })).status).toBe(422);
    expect((await api().put("/api/user/signature").set(user.auth).send({ kind: "selfie", dataUrl: PNG_DATA_URL })).status).toBe(400);
  });
});

describe("reminders and the subject line follow what the sender chose", () => {
  it("refuses them on the Free plan and uses them on Pro", async () => {
    const make = (account, extra) =>
      uploadPdf(account).then((doc) =>
        api()
          .post(`/api/send/${doc.id}`)
          .set(account.auth)
          .send({
            recipients: [{ id: "only", name: "Slow Signer", email: "slow@example.test" }],
            fields: [{ id: "sig", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.7, widthPercent: 0.25, heightPercent: 0.06, recipientId: "only" }],
            ...extra,
          })
          .then((res) => ({ res, doc }))
      );

    const free = await createUser();
    const refused = await make(free, { emailSubject: "Please sign today" });
    expect(refused.res.status).toBe(403);
    expect(refused.res.body.message).toMatch(/^UPGRADE_REQUIRED/);

    const pro = await createUser();
    await setPlan(pro.id, "pro_monthly");
    emailOutbox.length = 0;
    const sent = await make(pro, { emailSubject: "Please sign today", reminderCadence: "3days" });
    expect(sent.res.status).toBe(200);
    await flushEvents();
    expect(emailsTo("slow@example.test").map((m) => m.subject)).toContain("Please sign today");
    expect((await Pdf.findById(sent.doc.id)).reminderCadence).toBe("3days");
  });

  it("sends no automatic reminder unless the sender asked for one", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [{ name: "Quiet", email: "quiet@example.test" }]);
    await Recipient.collection.updateOne({ _id: recipients[0]._id }, { $set: { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } });
    emailOutbox.length = 0;

    await processAutomatedReminders();
    await flushEvents();
    expect(emailsTo("quiet@example.test").filter((m) => /Reminder/.test(m.subject))).toHaveLength(0);
  });
});
