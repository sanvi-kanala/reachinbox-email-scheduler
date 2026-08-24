import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./config/passport";
import { spawn } from "child_process";
import path from "path";

import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";

const app = express();

app.set("trust proxy", 1);

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const isProduction =
  process.env.NODE_ENV === "production";

/*
 * ============================
 * CORS
 * ============================
 */

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

/*
 * ============================
 * BODY PARSER
 * ============================
 */

app.use(express.json());

/*
 * ============================
 * SESSION
 * ============================
 */

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "development-secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction
        ? "none"
        : "lax",
      maxAge:
        24 * 60 * 60 * 1000,
    },
  })
);

/*
 * ============================
 * PASSPORT
 * ============================
 */

app.use(passport.initialize());
app.use(passport.session());

/*
 * ============================
 * HEALTH CHECK
 * ============================
 */

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message:
      "ReachInbox Email Scheduler backend is running",
  });
});

/*
 * ============================
 * ROUTES
 * ============================
 */

app.use("/auth", authRoutes);

app.use(
  "/api/emails",
  emailRoutes
);

/*
 * ============================
 * SERVER
 * ============================
 */

const PORT =
  Number(process.env.PORT) || 10000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server running on 0.0.0.0:${PORT}`
    );

    console.log(
      `Frontend URL: ${FRONTEND_URL}`
    );

    console.log(
      `Production mode: ${isProduction}`
    );

    /*
     * Start BullMQ worker in production.
     *
     * This allows us to use a single
     * free Render Web Service instead
     * of paying for a separate Background Worker.
     */

    if (isProduction) {
      const workerPath = path.join(
        __dirname,
        "queues",
        "email.worker.js"
      );

      console.log(
        "Starting email worker..."
      );

      const workerProcess = spawn(
        process.execPath,
        [workerPath],
        {
          stdio: "inherit",
          env: process.env,
        }
      );

      workerProcess.on(
        "error",
        (error) => {
          console.error(
            "Failed to start email worker:",
            error
          );
        }
      );

      workerProcess.on(
        "exit",
        (code) => {
          console.log(
            `Email worker exited with code ${code}`
          );
        }
      );
    }
  }
);