// Starts everything the browser tests need, on this machine only:
//
//   :5055  the real API, on a throwaway in-memory MongoDB and a temp uploads folder
//   :4173  the built client, served the way the production host serves it
//          (a file if there is one, a folder's index.html, otherwise the empty app shell)
//   :5056  a control port for the tests: create a document to sign, read a sent code
//
// Nothing here touches a real database, mailbox or storage bucket. Emails land in the
// server's in-memory test outbox.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "../server");
const clientDir = path.resolve(here, "../client");

const API_PORT = 5055;
const WEB_PORT = 4173;
const CONTROL_PORT = 5056;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const PASSWORD = "correct-horse-battery";

const requireFromServer = createRequire(path.join(serverDir, "package.json"));
const importFromServer = (file) => import(pathToFileURL(path.join(serverDir, file)).href);

// ---------- 1. Environment: must be in place before any server module is loaded ----------
const { MongoMemoryServer } = requireFromServer("mongodb-memory-server");
const mongo = await MongoMemoryServer.create();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pactdoc-e2e-"));

Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: String(API_PORT),
  MONGO_URI: mongo.getUri("pactdoc_e2e"),
  UPLOADS_DIR: path.join(tempRoot, "uploads"),
  STORAGE_PROVIDER: "local",
  JWT_ACCESS_SECRET: "e2e-access-secret-e2e-access-secret-000001",
  JWT_REFRESH_SECRET: "e2e-refresh-secret-e2e-refresh-secret-0001",
  ADMIN_SECRET_KEY: "e2e-admin-key-e2e-admin-key-e2e-admin-key-1",
  ADMIN_JWT_SECRET: "e2e-admin-jwt-secret-e2e-admin-jwt-secret-1",
  CORS_ORIGIN: WEB_URL,
  APP_URL: WEB_URL,
  APP_NAME: "PactDoc",
  RATE_LIMIT_DISABLED: "true",
  SMTP_USER: "",
  SMTP_PASS: "",
});

// ---------- 2. The client, built against this API ----------
if (!process.env.E2E_SKIP_BUILD) {
  execSync("npm run build", {
    cwd: clientDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", VITE_API_BASE_URL: API_URL, VITE_SITE_URL: WEB_URL },
  });
}
const dist = path.join(clientDir, "dist");
if (!fs.existsSync(path.join(dist, "app.html"))) throw new Error("client/dist/app.html is missing: the client build did not finish");

// ---------- 3. The API ----------
const { default: app } = await importFromServer("src/app.js");
const { connectDB } = await importFromServer("src/config/db.js");
const { initEventSystem } = await importFromServer("src/events/index.js");
const { User } = await importFromServer("src/models/User.model.js");
const { Recipient } = await importFromServer("src/models/Recipient.model.js");
const { Job } = await importFromServer("src/models/Job.model.js");
const { emailOutbox } = await importFromServer("src/config/email.js");
const { PDFDocument, StandardFonts } = requireFromServer("pdf-lib");
const { createCanvas } = requireFromServer("@napi-rs/canvas");

await connectDB();
initEventSystem();
await new Promise((resolve) => app.listen(API_PORT, resolve));

// ---------- 4. The client's static host ----------
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

const resolveStatic = (urlPath) => {
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const candidate = path.join(dist, safe);
  if (!candidate.startsWith(dist)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const index = path.join(candidate, "index.html");
  if (fs.existsSync(index)) return index;
  return path.join(dist, "app.html");
};

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, WEB_URL).pathname;
    // Paths the production host answers itself (its analytics script): absent here
    const file = pathname.startsWith("/_vercel/") ? null : resolveStatic(pathname);
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    const headers = { "Content-Type": type, "Cache-Control": "no-store" };
    // Text is sent compressed, as the production host sends it, so load times here mean something
    if (/text|javascript|json|xml|svg/.test(type) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      res.writeHead(200, { ...headers, "Content-Encoding": "gzip" });
      fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
      return;
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  })
  .listen(WEB_PORT);

// ---------- 5. The control port ----------
const waitForJobs = async () => {
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await pause(60);
  for (let i = 0; i < 200; i++) {
    const waiting = await Job.countDocuments({
      $or: [{ status: "running" }, { status: "pending", runAfter: { $lte: new Date() } }],
    });
    if (waiting === 0) break;
    await pause(30);
  }
};

const call = async (method, url, { token, json, form } = {}) => {
  const res = await fetch(`${API_URL}${url}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
};

// A page of random speckle, like a scanned sheet: it does not compress, so the file is realistically large
const scannedPage = () => {
  const canvas = createCanvas(600, 780);
  const context = canvas.getContext("2d");
  const image = context.createImageData(600, 780);
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = 200 + Math.floor(Math.random() * 56);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = shade;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas.toBuffer("image/jpeg", 80);
};

const makePdf = async ({ pages, scanned }) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([612, 792]);
    if (scanned) page.drawImage(await doc.embedJpg(scannedPage()), { x: 6, y: 6, width: 600, height: 780 });
    page.drawText(`Rent agreement - page ${i} of ${pages}`, { x: 72, y: 700, size: 16, font });
    page.drawText("The tenant agrees to pay the rent on the first day of every month.", { x: 72, y: 670, size: 11, font });
  }
  return Buffer.from(await doc.save());
};

let counter = 0;

/**
 * Creates a sender who can sign in, with one uploaded document that has not been sent yet.
 */
const draft = async ({ pages = 2, scanned = false } = {}) => {
  counter += 1;
  const ownerEmail = `owner${counter}@example.test`;

  await User.create({ name: "Meera Sharma", email: ownerEmail, password: PASSWORD, emailVerified: true, termsAccepted: true });
  const login = await call("POST", "/api/auth/login", { json: { email: ownerEmail, password: PASSWORD } });
  const token = login.data.accessToken;

  const pdf = await makePdf({ pages, scanned });
  const form = new FormData();
  form.append("pdf", new Blob([pdf], { type: "application/pdf" }), "rent-agreement.pdf");
  const uploaded = await call("POST", "/api/pdf/upload", { token, form });

  return { ownerEmail, password: PASSWORD, token, pdfId: uploaded.data.id, fileBytes: pdf.length, number: counter };
};

/**
 * Creates a sender, uploads a document and sends it to one signer.
 * The signer has a text field and a date field on page 1 and a signature field on the last page.
 */
const seed = async ({ language = "en", authType = "none", pages = 2, scanned = false, signerName = "Asha Rao" } = {}) => {
  const { token, pdfId, fileBytes, number } = await draft({ pages, scanned });
  const signerEmail = `signer${number}@example.test`;

  const field = (id, type, page, extra) => ({ id, type, page, required: true, recipientEmail: signerEmail, ...extra });
  await call("POST", `/api/send/${pdfId}`, {
    token,
    json: {
      recipients: [{ name: signerName, email: signerEmail, language, authType }],
      fields: [
        field("city", "text", 1, { xPercent: 0.12, yPercent: 0.3, widthPercent: 0.4, heightPercent: 0.06 }),
        field("date", "date", 1, { xPercent: 0.12, yPercent: 0.42, widthPercent: 0.4, heightPercent: 0.06 }),
        field("signature", "signature", pages, { xPercent: 0.12, yPercent: 0.6, widthPercent: 0.45, heightPercent: 0.1 }),
      ],
      message: "Please sign",
      signingOrder: false,
    },
  });
  await waitForJobs();

  const recipient = await Recipient.findOne({ pdfId });
  return {
    pdfId,
    signerEmail,
    signerName,
    token: recipient.token,
    signUrl: `${WEB_URL}/sign/${recipient.token}`,
    fileBytes,
  };
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
  });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${CONTROL_PORT}`);
    const reply = (status, body) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));

    try {
      if (url.pathname === "/ready") return reply(200, { ready: true });
      if (url.pathname === "/seed" && req.method === "POST") return reply(200, await seed(await readBody(req)));

      if (url.pathname === "/draft" && req.method === "POST") {
        const { token, ...rest } = await draft(await readBody(req));
        return reply(200, rest);
      }

      if (url.pathname === "/recipients") {
        await waitForJobs();
        const recipients = await Recipient.find({ pdfId: url.searchParams.get("pdfId") }).sort({ signingOrder: 1 });
        return reply(
          200,
          recipients.map((r) => ({
            name: r.name,
            email: r.email,
            language: r.language,
            channel: r.channel,
            status: r.status,
            token: r.token,
            emails: emailOutbox.filter((m) => m.to === r.email).map((m) => m.subject),
          }))
        );
      }

      if (url.pathname === "/otp") {
        await waitForJobs();
        // The subject of the code email starts with the code in square brackets, in every language
        const mail = [...emailOutbox].reverse().find((m) => m.to === url.searchParams.get("email") && /^\[\d{6}\]/.test(m.subject));
        return reply(200, { code: mail ? mail.subject.slice(1, 7) : null });
      }

      if (url.pathname === "/recipient") {
        await waitForJobs();
        const recipient = await Recipient.findOne({ token: url.searchParams.get("token") });
        return reply(200, {
          status: recipient?.status,
          consent: Boolean(recipient?.consent?.accepted),
          authVerified: Boolean(recipient?.authVerified),
        });
      }

      return reply(404, { error: "unknown control route" });
    } catch (error) {
      console.error("[e2e control]", error);
      return reply(500, { error: error.message });
    }
  })
  .listen(CONTROL_PORT, () => console.log(`[e2e] ready: web ${WEB_URL}, api ${API_URL}, control :${CONTROL_PORT}`));

const stop = async () => {
  await mongo.stop().catch(() => {});
  fs.rmSync(tempRoot, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
