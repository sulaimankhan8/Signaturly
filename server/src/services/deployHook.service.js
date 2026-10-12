import { env } from "../config/env.js";
import { enqueueJob, registerJobHandler } from "../jobs/queue.js";

/**
 * Rebuilding the public template pages (roadmap item A-29).
 *
 * Those pages are written when the client is built, so a template published, retired or
 * reviewed afterwards is not on them until the next build. The host gives a "deploy hook":
 * an address that starts a build when it is called. Several changes made together need one
 * build, so at most one is asked for in any five minutes.
 */

const WINDOW_MS = 5 * 60 * 1000;

export const requestClientRebuild = async (reason = "") => {
  if (!env.clientDeployHookUrl) return { configured: false, queued: false };

  const slot = Math.floor(Date.now() / WINDOW_MS);
  const job = await enqueueJob("client.rebuild", { reason }, { idempotencyKey: `client.rebuild:${slot}`, maxAttempts: 3 });
  return { configured: true, queued: Boolean(job) };
};

export const registerDeployHook = () => {
  registerJobHandler("client.rebuild", async () => {
    if (!env.clientDeployHookUrl) return;
    const res = await fetch(env.clientDeployHookUrl, { method: "POST", signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`The deploy hook answered ${res.status}`);
  });
};
