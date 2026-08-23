import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { emailQueue } from "../queues/email.queue";

const prisma = new PrismaClient();

const SENDER_ID =
  "f797a161-4e5d-4426-ac2b-446611455c62";

export async function scheduleEmail(
  req: Request,
  res: Response
) {
  try {
    const {
      recipient,
      subject,
      body,
      scheduledAt,
      userId,
      delayBetweenEmails = 2000,
      hourlyLimit = 100,
    } = req.body;

    if (
      !recipient ||
      !subject ||
      !body ||
      !scheduledAt ||
      !userId
    ) {
      return res.status(400).json({
        message:
          "recipient, subject, body, scheduledAt and userId are required",
      });
    }

    // Verify that the sender actually exists
    const sender = await prisma.sender.findUnique({
      where: {
        id: SENDER_ID,
      },
    });

    if (!sender) {
      return res.status(400).json({
        message:
          "Configured sender does not exist",
      });
    }

    const email = await prisma.email.create({
      data: {
        userId,
        senderId: sender.id,
        recipient,
        subject,
        body,
        scheduledAt: new Date(scheduledAt),
        status: "SCHEDULED",
        delayBetweenEmails,
        hourlyLimit,
      },
    });

    const delay = Math.max(
      0,
      new Date(scheduledAt).getTime() -
        Date.now()
    );

    const job = await emailQueue.add(
      "send-email",
      {
        emailId: email.id,
        recipient,
        subject,
        body,
        senderId: sender.id,
        userId,
        hourlyLimit,
        delayBetweenEmails,
      },
      {
        delay,
        jobId: `email-${email.id}`,
        attempts: 24,
        backoff: {
          type: "fixed",
          delay: 5 * 60 * 1000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    await prisma.email.update({
      where: {
        id: email.id,
      },
      data: {
        bullJobId: String(job.id),
      },
    });

    return res.status(201).json({
      message:
        "Email scheduled successfully",
      emailId: email.id,
      jobId: job.id,
      senderId: sender.id,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to schedule email",
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
}

export async function getScheduledEmails(
  req: Request,
  res: Response
) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId: String(userId),
        status: {
          in: ["SCHEDULED", "PROCESSING"],
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    return res.json(emails);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message:
        "Failed to fetch scheduled emails",
    });
  }
}

export async function getSentEmails(
  req: Request,
  res: Response
) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId: String(userId),
        status: {
          in: ["SENT", "FAILED"],
        },
      },
      orderBy: {
        sentAt: "desc",
      },
    });

    return res.json(emails);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch sent emails",
    });
  }
}