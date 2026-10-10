import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import routes from "./routes/index.js";
import webhookRoutes from "./routes/webhook.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { env } from "./config/env.js";

import { serveProtectedFile } from "./middlewares/file.middleware.js";
import { rejectOperatorKeys } from "./middlewares/validate.middleware.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";

const app = express();

// Behind Cloud Run's proxy the caller's address is in X-Forwarded-For; trust exactly the configured hops
if (env.trustProxy) {
  app.set("trust proxy", /^\d+$/.test(env.trustProxy) ? Number(env.trustProxy) : env.trustProxy);
}
app.disable("x-powered-by");

app.use(
  helmet({
    // The API serves JSON and files only; the web apps set their own content policy
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Exact-match origin list. An unlisted origin gets no CORS headers at all.
const allowedOrigins = String(env.corsOrigin || "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s && s !== "*");

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests with no Origin header (server-to-server, curl) carry no browser credentials
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

// Payment webhooks need the raw request bytes for signature checks, so they come before the JSON parser
app.use("/api/webhooks", webhookRoutes);

// Signing requests carry signature images as base64, so they get a larger limit than everything else
const signatureBody = express.json({ limit: "8mb" });
app.use("/api/signing", signatureBody);
app.use("/api/pdf/sign", signatureBody);
app.use("/api/send", signatureBody);
app.use("/api/templates", signatureBody);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(cookieParser());

app.use("/uploads", serveProtectedFile);

app.use("/api", apiLimiter, rejectOperatorKeys, routes);
app.use(errorMiddleware);

export default app;
