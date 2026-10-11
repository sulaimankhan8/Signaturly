import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { api, createUser } from "../helpers.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { env, buildEnv } from "../../src/config/env.js";

const planOf = async (userId) => (await Subscription.findOne({ userId }))?.plan || "free";

const stripeHeader = (payload, secret, timestamp = Math.floor(Date.now() / 1000)) => {
  const sig = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
};

const stripeEvent = (userId, id = "evt_1") =>
  JSON.stringify({
    id,
    type: "checkout.session.completed",
    data: { object: { metadata: { userId, plan: "pro_monthly" }, payment_status: "paid", amount_total: 599, currency: "usd" } },
  });

const razorpayEvent = (userId, paymentId = "pay_1") =>
  JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, amount: 29900, currency: "INR", notes: { userId, plan: "pro_monthly" } } } },
  });

const postRaw = (path, payload, headers = {}) =>
  api().post(path).set("Content-Type", "application/json").set(headers).send(payload);

// Audit finding C3: anyone could upgrade any account with one unsigned request.
describe("C3 payment webhooks must be signed", () => {
  it("ignores an unsigned Razorpay event", async () => {
    const user = await createUser();
    const res = await postRaw("/api/webhooks/razorpay", razorpayEvent(user.id));
    expect(res.status).toBe(400);
    expect(await planOf(user.id)).toBe("free");
  });

  it("ignores a Razorpay event signed with the wrong secret", async () => {
    const user = await createUser();
    const payload = razorpayEvent(user.id);
    const sig = crypto.createHmac("sha256", "wrong-secret").update(payload).digest("hex");
    const res = await postRaw("/api/webhooks/razorpay", payload, { "x-razorpay-signature": sig });
    expect(res.status).toBe(400);
    expect(await planOf(user.id)).toBe("free");
  });

  it("applies a correctly signed Razorpay event exactly once", async () => {
    const user = await createUser();
    const payload = razorpayEvent(user.id);
    const sig = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(payload).digest("hex");
    const headers = { "x-razorpay-signature": sig, "x-razorpay-event-id": "rzp_evt_1" };

    expect((await postRaw("/api/webhooks/razorpay", payload, headers)).status).toBe(200);
    expect(await planOf(user.id)).toBe("pro_monthly");

    await Subscription.updateOne({ userId: user.id }, { plan: "free" });
    const replay = await postRaw("/api/webhooks/razorpay", payload, headers);
    expect(replay.body.duplicate).toBe(true);
    expect(await planOf(user.id)).toBe("free");
  });

  it("ignores unsigned, wrongly signed and stale Stripe events", async () => {
    const user = await createUser();
    const payload = stripeEvent(user.id);

    expect((await postRaw("/api/webhooks/stripe", payload)).status).toBe(400);
    expect((await postRaw("/api/webhooks/stripe", payload, { "stripe-signature": stripeHeader(payload, "wrong") })).status).toBe(400);

    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(
      (await postRaw("/api/webhooks/stripe", payload, { "stripe-signature": stripeHeader(payload, env.stripeWebhookSecret, old) })).status
    ).toBe(400);

    expect(await planOf(user.id)).toBe("free");
  });

  it("applies a correctly signed Stripe event exactly once", async () => {
    const user = await createUser();
    const payload = stripeEvent(user.id, "evt_once");
    const headers = { "stripe-signature": stripeHeader(payload, env.stripeWebhookSecret) };

    expect((await postRaw("/api/webhooks/stripe", payload, headers)).status).toBe(200);
    expect(await planOf(user.id)).toBe("pro_monthly");

    await Subscription.updateOne({ userId: user.id }, { plan: "free" });
    expect((await postRaw("/api/webhooks/stripe", payload, headers)).body.duplicate).toBe(true);
    expect(await planOf(user.id)).toBe("free");
  });

  it("refuses every event when no webhook secret is configured", async () => {
    const user = await createUser();
    const saved = env.razorpayWebhookSecret;
    env.razorpayWebhookSecret = undefined;
    try {
      const res = await postRaw("/api/webhooks/razorpay", razorpayEvent(user.id));
      expect(res.status).toBe(503);
      expect(await planOf(user.id)).toBe("free");
    } finally {
      env.razorpayWebhookSecret = saved;
    }
  });

  it("ignores a plan name that does not exist", async () => {
    const user = await createUser();
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_x", notes: { userId: user.id, plan: "constructor" } } } },
    });
    const sig = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(payload).digest("hex");
    await postRaw("/api/webhooks/razorpay", payload, { "x-razorpay-signature": sig });
    expect(await planOf(user.id)).toBe("free");
  });
});

// Audit findings C2 and H2: a logged-in user could give themselves any plan.
describe("C2 / H2 no free upgrades", () => {
  it("never enables the simulated upgrade in production, whatever the settings say", () => {
    const prod = buildEnv({ NODE_ENV: "production", DEV_BILLING_SIMULATION: "true" });
    expect(prod.devBillingSimulation).toBe(false);
    expect(prod.billingEnabled).toBe(false);
  });

  it("refuses the simulated upgrade when simulation is off", async () => {
    const user = await createUser();
    const saved = env.devBillingSimulation;
    env.devBillingSimulation = false;
    try {
      const res = await api().post("/api/billing/dev-upgrade").set(user.auth).send({ plan: "enterprise" });
      expect(res.status).toBe(404);
      expect(await planOf(user.id)).toBe("free");
    } finally {
      env.devBillingSimulation = saved;
    }
  });

  it("returns an error, not a mock checkout, when no gateway is available", async () => {
    const user = await createUser();
    const saved = env.devBillingSimulation;
    env.devBillingSimulation = false;
    try {
      const res = await api().post("/api/billing/checkout").set(user.auth).send({ plan: "pro_monthly" });
      expect(res.status).toBe(503);
      expect(res.body.data?.isMock).toBeUndefined();
    } finally {
      env.devBillingSimulation = saved;
    }
  });

  it("says billing is unavailable when the flag is off", async () => {
    const user = await createUser();
    const saved = env.billingEnabled;
    env.billingEnabled = false;
    try {
      const res = await api().post("/api/billing/checkout").set(user.auth).send({ plan: "pro_monthly" });
      expect(res.status).toBe(503);
      expect(res.body.message).toContain("BILLING_UNAVAILABLE");
    } finally {
      env.billingEnabled = saved;
    }
  });
});
