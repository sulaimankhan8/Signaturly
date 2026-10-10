import { Job } from "../models/Job.model.js";

const handlers = new Map();
const failureHooks = new Map();

const LOCK_MS = 2 * 60 * 1000;
// Wait before attempt 2, 3, 4, 5
const BACKOFF_MS = [60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000];

/**
 * Registers the function that performs a job type. Handlers must be safe to run twice:
 * a job interrupted mid-way is run again.
 * `onFailed` is called once, when the last attempt has failed.
 */
export const registerJobHandler = (type, handler, { onFailed } = {}) => {
  handlers.set(type, handler);
  if (onFailed) failureHooks.set(type, onFailed);
};

const claim = (filter) =>
  Job.findOneAndUpdate(
    filter,
    { $set: { status: "running", lockedUntil: new Date(Date.now() + LOCK_MS) }, $inc: { attempts: 1 } },
    { new: true }
  );

const execute = async (job) => {
  const handler = handlers.get(job.type);

  try {
    if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
    await handler(job.payload || {}, job);

    await Job.updateOne(
      { _id: job._id },
      { $set: { status: "done", finishedAt: new Date(), lockedUntil: null, lastError: null } }
    );
    return "done";
  } catch (err) {
    const message = String(err?.message || err).slice(0, 500);
    const exhausted = job.attempts >= job.maxAttempts;

    await Job.updateOne(
      { _id: job._id },
      exhausted
        ? { $set: { status: "failed", finishedAt: new Date(), lockedUntil: null, lastError: message } }
        : {
            $set: {
              status: "pending",
              lockedUntil: null,
              lastError: message,
              runAfter: new Date(Date.now() + BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)]),
            },
          }
    );

    if (exhausted) {
      console.error(`[Jobs] ${job.type} failed permanently after ${job.attempts} attempts: ${message}`);
      try {
        await failureHooks.get(job.type)?.(job.payload || {}, message);
      } catch (hookErr) {
        console.error(`[Jobs] failure hook for ${job.type} threw:`, hookErr.message);
      }
    }
    return exhausted ? "failed" : "retry";
  }
};

// Runs one job now if it is due and nobody else has it
export const runJob = async (jobId) => {
  const job = await claim({ _id: jobId, status: "pending", runAfter: { $lte: new Date() } });
  return job ? execute(job) : "skipped";
};

/**
 * Queues work. It is saved first, then attempted straight away in this process;
 * if that attempt fails or the process stops, the scheduler-driven runner picks it up later.
 */
export const enqueueJob = async (type, payload = {}, { idempotencyKey, maxAttempts, runAfter } = {}) => {
  let job;
  try {
    job = await Job.create({ type, payload, idempotencyKey, maxAttempts, runAfter });
  } catch (err) {
    if (err?.code === 11000) return null; // already queued under this key
    throw err;
  }

  if (!runAfter || runAfter <= new Date()) {
    setImmediate(() => {
      runJob(job._id).catch((err) => console.error("[Jobs] immediate run failed:", err.message));
    });
  }
  return job;
};

/**
 * Runs every job that is due, plus any whose earlier run was interrupted.
 * Called on a schedule from outside the process.
 */
export const runDueJobs = async ({ limit = 50 } = {}) => {
  const summary = { done: 0, retry: 0, failed: 0 };

  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const job = await claim({
      $or: [
        { status: "pending", runAfter: { $lte: now } },
        { status: "running", lockedUntil: { $lt: now } },
      ],
    });
    if (!job) break;

    // An interrupted job that has used all its attempts is closed out, not run forever
    if (job.attempts > job.maxAttempts) {
      await Job.updateOne(
        { _id: job._id },
        { $set: { status: "failed", finishedAt: new Date(), lockedUntil: null, lastError: "Interrupted too many times" } }
      );
      summary.failed += 1;
      continue;
    }

    summary[await execute(job)] += 1;
  }

  return summary;
};
