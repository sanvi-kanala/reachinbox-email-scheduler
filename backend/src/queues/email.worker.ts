import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import redis from "../config/redis";

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  host: process.env.ETHEREAL_HOST,
  port: Number(process.env.ETHEREAL_PORT),
  secure: false,
  auth: {
    user: process.env.ETHEREAL_USER,
    pass: process.env.ETHEREAL_PASSWORD,
  },
});

async function waitForHourlyLimit(
  userId: string,
  hourlyLimit: number
) {
  if (!userId || hourlyLimit <= 0) {
    return;
  }

  const key = `email-rate:${userId}`;

  while (true) {
    const count = await redis.get(key);

    const currentCount = Number(count || 0);

    if (currentCount < hourlyLimit) {
      const newCount = await redis.incr(key);

      if (newCount === 1) {
        await redis.expire(key, 60 * 60);
      }

      if (newCount <= hourlyLimit) {
        return;
      }

      await redis.decr(key);
    }

    console.log(
      `Hourly limit reached for user ${userId}. Waiting...`
    );

    await new Promise((resolve) =>
      setTimeout(resolve, 5000)
    );
  }
}

const emailWorker = new Worker(
  "email-queue",

  async (job) => {
    console.log(
      `Processing job: ${job.id}`
    );

    const {
      emailId,
      recipient,
      subject,
      body,
      userId,
      hourlyLimit = 100,
    } = job.data;

    try {
      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          status: "PROCESSING",
          attempts: {
            increment: 1,
          },
        },
      });

      // Enforce hourly sending limit
      await waitForHourlyLimit(
        userId,
        Number(hourlyLimit)
      );

      const info =
        await transporter.sendMail({
          from: `"ReachInbox" <${process.env.ETHEREAL_USER}>`,
          to: recipient,
          subject,
          text: body,
        });

      const previewUrl =
        nodemailer.getTestMessageUrl(info);

      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      console.log(
        "Email sent successfully!"
      );

      console.log(
        "Message ID:",
        info.messageId
      );

      console.log(
        "Preview URL:",
        previewUrl
      );

      return {
        success: true,
        messageId: info.messageId,
        previewUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown email sending error";

      console.error(
        `Email ${emailId} failed:`,
        errorMessage
      );

      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          errorMessage,
        },
      });

      throw error;
    }
  },

  {
    connection: redis,

    concurrency:
      Number(
        process.env.WORKER_CONCURRENCY
      ) || 5,

    limiter: {
      max: Number(
        process.env.WORKER_CONCURRENCY
      ) || 5,
      duration: 1000,
    },
  }
);

emailWorker.on(
  "completed",
  (job) => {
    console.log(
      `Job ${job.id} completed`
    );
  }
);

emailWorker.on(
  "failed",
  async (job, error) => {
    if (!job) return;

    console.error(
      `Job ${job.id} failed:`,
      error.message
    );

    if (
      job.attemptsMade >=
      (job.opts.attempts || 1)
    ) {
      const emailId =
        job.data?.emailId;

      if (emailId) {
        try {
          await prisma.email.update({
            where: {
              id: emailId,
            },
            data: {
              status: "FAILED",
              errorMessage:
                error.message,
            },
          });

          console.log(
            `Email ${emailId} marked as FAILED`
          );
        } catch (dbError) {
          console.error(
            "Failed to update email status:",
            dbError
          );
        }
      }
    }
  }
);

console.log(
  "Email worker started"
);