import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import routes from "./routes/index.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { env } from "./config/env.js";
import path from "path";





const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));


app.use(cors({
    origin:env.corsOrigin,
    credentials: true,
}));
app.use(
  "/uploads",
  express.static(path.resolve("uploads"))
);
app.use("/api",routes);
app.use(errorMiddleware);

export default app;