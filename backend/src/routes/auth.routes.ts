import { Router } from "express";
import passport from "../config/passport";

const router = Router();

// Start Google login
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:5173/login",
  }),
  (_req, res) => {
    res.redirect("http://localhost:5173/dashboard");
  }
);

// Current logged-in user
router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      message: "Not authenticated",
    });
  }

  res.json(req.user);
});

// Logout
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        message: "Logout failed",
      });
    }

    req.session.destroy(() => {
      res.json({
        message: "Logged out successfully",
      });
    });
  });
});

export default router;