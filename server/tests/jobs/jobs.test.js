import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, createUser, sendDocument, flushEvents, emailsTo, reloadRecipient, reloadPdf, signAs } from "../helpers.js";
import { Job } from "../../src/models/Job.model.js";
import { enqueueJob, runDueJobs, registerJobHandler } from "../../src/jobs/queue.js";
import * as emailConfig from "../../src/config/email.js";
import { env } from "../../src/config/env.js";

const signer = { name: "Asha Rao", email: "asha@example.test" };

// Push every waiting job's time back so the next run picks it up without waiting for the back-off
const makeAllDue = () => Job.updateMany({ status: "pending" }, { $set: { runAfter: new Date(Date.now() - 1000) } });

// Audit finding H11: emails were sent once, in memory, and failures were swallowed.
describe("H11 background jobs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("saves the invitation as a job and sends it", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [signer]);

    const job = await Job.findOne({ type: "email.signing_request" });
    expect(job.status).toBe("done");
    expect(job.payload.recipientId).toBe(recipients[0]._id.toString());
    expect(emailsTo(signer.email)).toHaveLength(1);
    expect((await reloadRecipient(recipients[0]._id)).delivery.status).toBe("sent");
  });

  it("retries a failed email and delivers it when the mail server recovers", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = emailConfig.emailOutbox;
    let failing = true;
    const push = original.push.bind(original);
    original.push = (...args) => {
      if (failing) throw new Error("SMTP connection refused");
      return push(...args);
    };

    try {
      const sender = await createUser();
      const { recipients } = await sendDocument(sender, [signer]);

      const job = await Job.findOne({ type: "email.signing_request" });
      expect(job.status).toBe("pending");
      expect(job.attempts).toBe(1);
      expect(job.lastError).toContain("SMTP connection refused");
      expect(job.runAfter.getTime()).toBeGreaterThan(Date.now());
      expect(emailsTo(signer.email)).toHaveLength(0);

      failing = false;
      await makeAllDue();
      const summary = await runDueJobs();

      expect(summary.done).toBe(1);
      expect(emailsTo(signer.email)).toHaveLength(1);
      expect((await reloadRecipient(recipients[0]._id)).delivery.status).toBe("sent");
    } finally {
      original.push = push;
      errors.mockRestore();
    }
  });

  it("gives up after the last attempt and marks the invitation undelivered", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = emailConfig.emailOutbox;
    const push = original.push.bind(original);
    original.push = () => {
      throw new Error("mailbox unavailable");
    };

    try {
      const sender = await createUser();
      const { recipients } = await sendDocument(sender, [signer]);

      for (let i = 0; i < 6; i++) {
        await makeAllDue();
        await runDueJobs();
      }

      const job = await Job.findOne({ type: "email.signing_request" });
      expect(job.status).toBe("failed");
      expect(job.attempts).toBe(5);

      const stored = await reloadRecipient(recipients[0]._id);
      expect(stored.delivery.status).toBe("failed");
      expect(stored.delivery.lastError).toContain("mailbox unavailable");
    } finally {
      original.push = push;
      errors.mockRestore();
    }
  });

  it("does not queue the same work twice", async () => {
    let runs = 0;
    registerJobHandler("test.once", async () => {
      runs += 1;
    });

    const first = await enqueueJob("test.once", {}, { idempotencyKey: "same-key" });
    const second = await enqueueJob("test.once", {}, { idempotencyKey: "same-key" });
    await flushEvents();

    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(runs).toBe(1);
  });

  it("picks up a job whose run was interrupted", async () => {
    let runs = 0;
    registerJobHandler("test.interrupted", async () => {
      runs += 1;
    });

    await Job.create({
      type: "test.interrupted",
      status: "running",
      attempts: 1,
      lockedUntil: new Date(Date.now() - 60 * 1000),
    });

    const summary = await runDueJobs();
    expect(summary.done).toBe(1);
    expect(runs).toBe(1);
  });

  it("tells the owner as well as the signers when a document is complete", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [signer]);
    await signAs(recipients[0].token, ["sig-1"]);
    await flushEvents();

    expect(emailsTo(sender.email).some((m) => /Completed/.test(m.subject))).toBe(true);
    expect(emailsTo(signer.email).some((m) => /Completed/.test(m.subject))).toBe(true);
  });

  it("keeps the signature and seals later if sealing fails at signing time", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { resetSealCredentials } = await import("../../src/services/pdfSeal.service.js");
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [signer]);

    // An unreadable certificate makes sealing fail
    const saved = env.sealP12Base64;
    env.sealP12Base64 = Buffer.from("not a certificate").toString("base64");
    resetSealCredentials();

    let res;
    try {
      res = await signAs(recipients[0].token, ["sig-1"]);
      await flushEvents();

      // The signature stands whatever happened to the seal
      expect(res.status).toBe(200);
      const unsealed = await reloadPdf(pdfId);
      expect(unsealed.status).toBe("signed");
      expect(unsealed.sealedKey).toBeNull();
      expect((await Job.findOne({ type: "document.seal" })).status).toBe("pending");
    } finally {
      env.sealP12Base64 = saved;
      resetSealCredentials();
    }

    // With the certificate back, the queued job seals the document
    await makeAllDue();
    await runDueJobs();
    errors.mockRestore();

    expect((await reloadPdf(pdfId)).sealedKey).toMatch(/-sealed\.pdf$/);
    expect((await Job.findOne({ type: "document.seal" })).status).toBe("done");
  });
});

describe("scheduler endpoints", () => {
  it("are closed without the shared secret", async () => {
    env.internalSecret = "scheduler-secret-for-tests";
    for (const path of ["/api/internal/jobs/run", "/api/internal/cron/reminders", "/api/internal/cron/expirations"]) {
      expect((await api().post(path)).status, path).toBe(403);
      expect((await api().post(path).set("x-internal-secret", "wrong")).status, path).toBe(403);
    }
  });

  it("are closed when no secret is configured at all", async () => {
    env.internalSecret = undefined;
    expect((await api().post("/api/internal/jobs/run").set("x-internal-secret", "")).status).toBe(403);
    expect((await api().post("/api/internal/jobs/run").set("x-internal-secret", "undefined")).status).toBe(403);
  });

  it("run due work with the secret", async () => {
    env.internalSecret = "scheduler-secret-for-tests";
    let runs = 0;
    registerJobHandler("test.scheduled", async () => {
      runs += 1;
    });
    await Job.create({ type: "test.scheduled", runAfter: new Date(Date.now() - 1000) });

    const res = await api().post("/api/internal/jobs/run").set("x-internal-secret", env.internalSecret);
    expect(res.status).toBe(200);
    expect(res.body.done).toBe(1);
    expect(runs).toBe(1);

    expect((await api().post("/api/internal/cron/expirations").set("x-internal-secret", env.internalSecret)).status).toBe(200);
  });
});
