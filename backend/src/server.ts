import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./config/passport";

import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";

const app = express();

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

const isProduction =
  process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

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
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message:
      "ReachInbox Email Scheduler backend is running",
  });
});

app.use("/auth", authRoutes);

app.use("/api/emails", emailRoutes);

const PORT =
  Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});