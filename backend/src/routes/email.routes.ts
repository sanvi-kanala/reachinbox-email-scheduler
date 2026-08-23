import { Router } from "express";
import { emailQueue } from "../queues/email.queue";
import {
  scheduleEmail,
  getScheduledEmails,
  getSentEmails,
} from "../controllers/email.controller";

const router = Router();

// Temporary BullMQ test route
router.post("/test", async (_req, res) => {
  const job = await emailQueue.add(
    "test-email",
    {
      recipient: "test@example.com",
      subject: "ReachInbox Test",
    },
    {
      delay: 5000,
    }
  );

  res.json({
    message: "Test job scheduled",
    jobId: job.id,
  });
});

// Schedule emails
router.post("/schedule", scheduleEmail);

// Get scheduled emails
router.get("/scheduled", getScheduledEmails);

// Get sent/failed emails
router.get("/sent", getSentEmails);

export default router;