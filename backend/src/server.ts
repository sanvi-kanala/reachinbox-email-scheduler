import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./config/passport";
import { spawn } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";

import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";

const prisma = new PrismaClient();

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
 * CREATE DEFAULT SENDER
 * ============================
 */

async function ensureSender() {
  const senderId =
    "f797a161-4e5d-4426-ac2b-446611455c62";

  const etherealUser =
    process.env.ETHEREAL_USER;

  const etherealPassword =
    process.env.ETHEREAL_PASSWORD;

  if (
    !etherealUser ||
    !etherealPassword
  ) {
    console.error(
      "Ethereal credentials are missing."
    );

    return;
  }

  try {
    const existingSender =
      await prisma.sender.findUnique({
        where: {
          id: senderId,
        },
      });

    if (existingSender) {
      console.log(
        "Configured sender already exists"
      );

      return;
    }

    await prisma.sender.create({
      data: {
        id: senderId,
        name: "ReachInbox",
        email: etherealUser,
        etherealUser,
        etherealPassword,
      },
    });

    console.log(
      "Default sender created successfully"
    );
  } catch (error) {
    console.error(
      "Failed to create default sender:",
      error
    );
  }
}

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
  async () => {
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
     * Make sure the production
     * sender exists.
     */

    await ensureSender();

    /*
     * Start BullMQ worker in production.
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