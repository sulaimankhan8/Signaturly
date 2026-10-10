import request from "supertest";
import { PDFDocument } from "pdf-lib";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Recipient } from "../src/models/Recipient.model.js";
import { Pdf } from "../src/models/Pdf.model.js";
import { emailOutbox } from "../src/config/email.js";
import { Job } from "../src/models/Job.model.js";

export { app };
export const api = () => request(app);

export const PASSWORD = "correct-horse-battery";

// Smallest valid PNG: one transparent pixel
export const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// Emails are queued as jobs just after the request returns; wait until none are left to run
export const flushEvents = async () => {
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await pause(40);
  for (let i = 0; i < 100; i++) {
    const waiting = await Job.countDocuments({
      $or: [{ status: "running" }, { status: "pending", runAfter: { $lte: new Date() } }],
    });
    if (waiting === 0) break;
    await pause(30);
  }
  await pause(20);
};

let userCounter = 0;

export const createUser = async ({ verified = true, role = "user", email } = {}) => {
  userCounter += 1;
  const address = email || `user${userCounter}-${Date.now()}@example.test`;
  const user = await User.create({
    name: `Test User ${userCounter}`,
    email: address,
    password: PASSWORD,
    role,
    emailVerified: verified,
  });

  const res = await api().post("/api/auth/login").send({ email: address, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);

  return {
    user,
    id: user._id.toString(),
    email: address,
    token: res.body.data.accessToken,
    cookies: res.headers["set-cookie"],
    auth: { Authorization: `Bearer ${res.body.data.accessToken}` },
  };
};

export const makePdfBuffer = async (pages = 1) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Test agreement page ${i + 1}`, { x: 72, y: 700, size: 14 });
  }
  return Buffer.from(await doc.save());
};

export const uploadPdf = async (account, { pages = 1, filename = "agreement.pdf" } = {}) => {
  const res = await api()
    .post("/api/pdf/upload")
    .set(account.auth)
    .attach("pdf", await makePdfBuffer(pages), { filename, contentType: "application/pdf" });
  if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
};

export const signatureField = (id, recipientEmail, extra = {}) => ({
  id,
  type: "signature",
  page: 1,
  xPercent: 0.1,
  yPercent: 0.8,
  widthPercent: 0.25,
  heightPercent: 0.06,
  required: true,
  recipientEmail,
  ...extra,
});

/**
 * Uploads a document and sends it. Returns the document id and the stored recipients in signing order.
 */
export const sendDocument = async (account, recipients, { signingOrder = false, fields, expiresAt } = {}) => {
  const uploaded = await uploadPdf(account);
  const docFields = fields || recipients.map((r, i) => signatureField(`sig-${i + 1}`, r.email));

  const res = await api()
    .post(`/api/send/${uploaded.id}`)
    .set(account.auth)
    .send({ recipients, fields: docFields, message: "Please sign", signingOrder, expiresAt });
  if (res.status !== 200) throw new Error(`send failed: ${res.status} ${JSON.stringify(res.body)}`);

  await flushEvents();
  const stored = await Recipient.find({ pdfId: uploaded.id }).sort({ signingOrder: 1 });
  return { pdfId: uploaded.id, recipients: stored, upload: uploaded };
};

export const signAs = (token, fieldIds, extra = {}) =>
  api()
    .post(`/api/signing/${token}/sign`)
    .send({
      consent: true,
      fields: fieldIds.map((id) => ({ id, signatureUrl: PNG_DATA_URL, value: PNG_DATA_URL })),
      ...extra,
    });

export const emailsTo = (address) => emailOutbox.filter((m) => m.to === address);

export const latestOtpFor = (address) => {
  const mail = [...emailOutbox].reverse().find((m) => m.to === address && /verification code/i.test(m.text || ""));
  const match = mail && /is: (\d{6})/.exec(mail.text);
  return match ? match[1] : null;
};

export const reloadRecipient = (id) => Recipient.findById(id);
export const reloadPdf = (id) => Pdf.findById(id);
