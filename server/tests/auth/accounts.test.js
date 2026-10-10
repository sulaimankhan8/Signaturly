import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { api, createUser, PASSWORD, uploadPdf, emailsTo, flushEvents } from "../helpers.js";
import { User } from "../../src/models/User.model.js";
import { PasswordReset } from "../../src/models/PasswordReset.model.js";
import { env, buildEnv, validateEnv } from "../../src/config/env.js";

const cookieValue = (setCookie) => setCookie.find((c) => c.startsWith("refreshToken=")).split(";")[0];

describe("M6 account hygiene", () => {
  it("rejects short passwords at registration", async () => {
    const res = await api().post("/api/auth/register").send({ name: "A", email: "short@example.test", password: "short1" });
    expect(res.status).toBe(400);
    expect(await User.countDocuments({ email: "short@example.test" })).toBe(0);
  });

  it("asks new accounts to confirm their email before sending documents", async () => {
    const reg = await api().post("/api/auth/register").send({ name: "New Person", email: "new@example.test", password: PASSWORD });
    expect(reg.status).toBe(201);

    const login = await api().post("/api/auth/login").send({ email: "new@example.test", password: PASSWORD });
    expect(login.body.data.user.emailVerified).toBe(false);
    const account = { auth: { Authorization: `Bearer ${login.body.data.accessToken}` } };

    const doc = await uploadPdf(account);
    const blocked = await api()
      .post(`/api/send/${doc.id}`)
      .set(account.auth)
      .send({ recipients: [{ name: "S", email: "s@example.test" }], fields: [] });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toContain("EMAIL_NOT_VERIFIED");

    const mail = emailsTo("new@example.test").find((m) => /Confirm/.test(m.subject));
    const token = /verify-email\?token=([a-f0-9]+)/.exec(mail.text)[1];

    expect((await api().post("/api/auth/verify-email").send({ token: "0".repeat(64) })).status).toBe(400);
    expect((await api().post("/api/auth/verify-email").send({ token })).status).toBe(200);
    // The link works once
    expect((await api().post("/api/auth/verify-email").send({ token })).status).toBe(400);

    const allowed = await api()
      .post(`/api/send/${doc.id}`)
      .set(account.auth)
      .send({ recipients: [{ name: "S", email: "s@example.test" }], fields: [] });
    expect(allowed.status).toBe(200);
  });

  it("stores only a hash of the refresh token and rotates it on use", async () => {
    const account = await createUser();
    const first = cookieValue(account.cookies);

    const stored = await User.findById(account.id).select("+refreshTokenHash");
    expect(stored.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain(stored.refreshTokenHash);

    const refreshed = await api().post("/api/auth/refresh-token").set("Cookie", first);
    expect(refreshed.status).toBe(200);
    const second = cookieValue(refreshed.headers["set-cookie"]);
    expect(second).not.toBe(first);

    // Once the short overlap window has passed, the replaced token is dead and its reuse ends the session
    await User.updateOne({ _id: account.id }, { refreshRotatedAt: new Date(Date.now() - 5 * 60 * 1000) });
    expect((await api().post("/api/auth/refresh-token").set("Cookie", first)).status).toBe(401);
    expect((await api().post("/api/auth/refresh-token").set("Cookie", second)).status).toBe(401);
  });

  it("tolerates two tabs refreshing at the same moment", async () => {
    const account = await createUser();
    const cookie = cookieValue(account.cookies);

    const [a, b] = await Promise.all([
      api().post("/api/auth/refresh-token").set("Cookie", cookie),
      api().post("/api/auth/refresh-token").set("Cookie", cookie),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 200]);
  });

  it("hashes reset tokens, uses them once, and signs out old sessions", async () => {
    const account = await createUser({ email: "reset@example.test" });
    const oldCookie = cookieValue(account.cookies);

    expect((await api().post("/api/auth/forgot-password").send({ email: "reset@example.test" })).status).toBe(200);
    const mail = emailsTo("reset@example.test").find((m) => /Reset/.test(m.subject));
    const token = /reset-password\?token=([a-f0-9]+)/.exec(mail.text)[1];

    const record = await PasswordReset.findOne({ userId: account.id });
    expect(record.token).not.toBe(token);

    const newPassword = "an-entirely-new-password";
    expect((await api().post("/api/auth/reset-password").send({ token, newPassword })).status).toBe(200);
    expect((await api().post("/api/auth/reset-password").send({ token, newPassword: "another-new-password" })).status).toBe(400);

    expect((await api().post("/api/auth/refresh-token").set("Cookie", oldCookie)).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email: "reset@example.test", password: PASSWORD })).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email: "reset@example.test", password: newPassword })).status).toBe(200);
  });

  it("answers the same way for unknown emails", async () => {
    const res = await api().post("/api/auth/forgot-password").send({ email: "nobody@example.test" });
    expect(res.status).toBe(200);
    expect(emailsTo("nobody@example.test")).toHaveLength(0);
  });
});

// Audit finding H10: tokens in URLs, open origins, weak cookies.
describe("H10 tokens, cookies and origins", () => {
  it("ignores a login token passed in the query string", async () => {
    const account = await createUser();
    expect((await api().get(`/api/pdf/my-documents?token=${account.token}`)).status).toBe(401);
    expect((await api().get("/api/pdf/my-documents").set(account.auth)).status).toBe(200);
  });

  it("marks the refresh cookie HttpOnly, and Secure in production", async () => {
    const account = await createUser();
    const cookie = account.cookies.find((c) => c.startsWith("refreshToken="));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    env.isProd = true;
    try {
      const res = await api().post("/api/auth/login").send({ email: account.email, password: PASSWORD });
      expect(res.headers["set-cookie"].find((c) => c.startsWith("refreshToken="))).toMatch(/Secure/i);
    } finally {
      env.isProd = false;
    }
  });

  it("sends CORS headers only to listed origins", async () => {
    const listed = await api().get("/api/health").set("Origin", "http://localhost:5173");
    expect(listed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    const unlisted = await api().get("/api/health").set("Origin", "https://evil.example");
    expect(unlisted.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sets security headers and hides the framework", async () => {
    const res = await api().get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["strict-transport-security"]).toBeTruthy();
  });
});

// Audit finding H5: the admin key promoted any account to superadmin.
describe("H5 admin access", () => {
  const login = (email, adminSecret = env.adminSecret) =>
    api().post("/api/admin/login").send({ email, password: PASSWORD, adminSecret });

  it("does not promote a normal user who knows the admin key", async () => {
    const user = await createUser();
    const res = await login(user.email);
    expect(res.status).toBe(401);
    expect((await User.findById(user.id)).role).toBe("user");
  });

  it("refuses a real admin with the wrong key", async () => {
    const admin = await createUser({ role: "superadmin" });
    expect((await login(admin.email, "wrong-key")).status).toBe(401);
  });

  it("lets a seeded admin in, with a token normal routes do not accept", async () => {
    const admin = await createUser({ role: "superadmin" });
    const res = await login(admin.email);
    expect(res.status).toBe(200);
    const adminToken = res.body.adminToken;

    expect((await api().get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`)).status).toBe(200);
    expect((await api().get("/api/pdf/my-documents").set("Authorization", `Bearer ${adminToken}`)).status).toBe(401);
  });

  it("refuses user tokens on admin routes, even ones that claim to be admin", async () => {
    const admin = await createUser({ role: "superadmin" });
    expect((await api().get("/api/admin/users").set(admin.auth)).status).toBe(401);

    const forged = jwt.sign({ id: admin.id, role: "superadmin", isAdmin: true }, env.accessSecret, { expiresIn: "1h" });
    expect((await api().get("/api/admin/users").set("Authorization", `Bearer ${forged}`)).status).toBe(401);
  });

  it("stops working when the admin is demoted", async () => {
    const admin = await createUser({ role: "superadmin" });
    const adminToken = (await login(admin.email)).body.adminToken;
    await User.updateOne({ _id: admin.id }, { role: "user" });
    expect((await api().get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`)).status).toBe(403);
  });
});

describe("H5 configuration is checked at start-up", () => {
  const good = {
    NODE_ENV: "production",
    MONGO_URI: "mongodb://example/db",
    JWT_ACCESS_SECRET: "a".repeat(40),
    JWT_REFRESH_SECRET: "b".repeat(40),
    ADMIN_SECRET_KEY: "c".repeat(40),
    ADMIN_JWT_SECRET: "d".repeat(40),
    CORS_ORIGIN: "https://app.pactdoc.com",
    AUDIT_HMAC_KEY: "e".repeat(40),
    SEAL_P12_BASE64: "ZmFrZS1wMTI=",
    INTERNAL_JOB_SECRET: "f".repeat(40),
  };

  it("accepts a complete production configuration", () => {
    expect(validateEnv(buildEnv(good))).toEqual([]);
  });

  it.each([
    "MONGO_URI",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "ADMIN_SECRET_KEY",
    "ADMIN_JWT_SECRET",
    "AUDIT_HMAC_KEY",
    "SEAL_P12_BASE64",
    "INTERNAL_JOB_SECRET",
  ])(
    "refuses to start without %s",
    (name) => {
      const problems = validateEnv(buildEnv({ ...good, [name]: "" }));
      expect(problems.join(" ")).toContain(name);
    }
  );

  it("refuses placeholder, short, shared and wildcard values", () => {
    expect(validateEnv(buildEnv({ ...good, ADMIN_SECRET_KEY: "signaturly-superadmin-secret" })).length).toBeGreaterThan(0);
    expect(validateEnv(buildEnv({ ...good, JWT_ACCESS_SECRET: "short" })).length).toBeGreaterThan(0);
    expect(validateEnv(buildEnv({ ...good, ADMIN_JWT_SECRET: good.JWT_ACCESS_SECRET })).length).toBeGreaterThan(0);
    expect(validateEnv(buildEnv({ ...good, CORS_ORIGIN: "*" })).length).toBeGreaterThan(0);
  });
});
