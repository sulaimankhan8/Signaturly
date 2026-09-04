import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import routes from "./routes/index.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { env } from "./config/env.js";
import path from "path";

import { serveProtectedFile } from "./middlewares/file.middleware.js";

const app = express();

// Increase JSON and URL-encoded body limit to 50MB for high-res base64 signature payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Parse comma-separated or single CORS origins for frontend and admin hosting
const allowedOrigins = typeof env.corsOrigin === "string"
  ? env.corsOrigin.split(",").map((s) => s.trim()).filter(Boolean)
  : [env.corsOrigin];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
        callback(null, true);
      } else {
        callback(null, origin);
      }
    },
    credentials: true,
  })
);

app.use("/uploads", serveProtectedFile);

app.use("/api", routes);
app.use(errorMiddleware);

export default app;