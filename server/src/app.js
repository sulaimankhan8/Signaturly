import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import routes from "./routes/index.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { env } from "./config/env.js";
import path from "path";

const app = express();

// Increase JSON and URL-encoded body limit to 50MB for high-res base64 signature payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: env.corsOrigin || true,
    credentials: true,
  })
);

app.use(
  "/uploads",
  express.static(path.resolve("uploads"))
);

app.use("/api", routes);
app.use(errorMiddleware);

export default app;