import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import redis from "../config/redis";

const prisma = new PrismaClient();

/*
 * ==========================================
 * ETHEREAL TRANSPORTER
 * ==========================================
 *
 * Used for local development.
 */

const transporter = nodemailer.createTransport({
  host: process.env.ETHEREAL_HOST,
  port: Number(process.env.ETHEREAL_PORT) || 587,
  secure: false,

  auth: {
    user: process.env.ETHEREAL_USER,
    pass: process.env.ETHEREAL_PASSWORD,
  },
});

/*
 * ==========================================
 * RESEND
 * ==========================================
 *
 * Used in production on Render.
 */

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/*
 * ==========================================
 * HOURLY RATE LIMIT
 * ==========================================
 */

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

    const currentCount = Number(
      count || 0
    );

    if (currentCount < hourlyLimit) {
      const newCount =
        await redis.incr(key);

      if (newCount === 1) {
        await redis.expire(
          key,
          60 * 60
        );
      }

      if (newCount <= hourlyLimit) {
        return;
      }

      await redis.decr(key);
    }

    console.log(
      `Hourly limit reached for user ${userId}. Waiting...`
    );

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 5000)
    );
  }
}

/*
 * ==========================================
 * EMAIL WORKER
 * ==========================================
 */

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
      /*
       * Mark email as PROCESSING
       */

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

      /*
       * Enforce hourly limit
       */

      await waitForHourlyLimit(
        userId,
        Number(hourlyLimit)
      );

      /*
       * ======================================
       * PRODUCTION → RESEND
       * LOCAL → ETHEREAL
       * ======================================
       */

      const isProduction =
        process.env.NODE_ENV ===
        "production";

      let messageId: string | undefined;

      let previewUrl:
        | string
        | false
        | undefined;

      /*
       * ======================================
       * PRODUCTION
       * ======================================
       */

      if (isProduction) {
        if (!resend) {
          throw new Error(
            "RESEND_API_KEY is not configured"
          );
        }

        const resendFrom =
          process.env.RESEND_FROM ||
          "onboarding@resend.dev";

        console.log(
          `Sending email through Resend to ${recipient}`
        );

        const {
          data,
          error,
        } = await resend.emails.send(
          {
            from: resendFrom,

            to: [recipient],

            subject,

            html: body,

            text: body,
          },

          {
            idempotencyKey:
              `reachinbox-${emailId}`,
          }
        );

        if (error) {
          throw new Error(
            `Resend error: ${error.message}`
          );
        }

        messageId =
          data?.id;

        console.log(
          "Email sent through Resend successfully!"
        );

        console.log(
          "Resend Message ID:",
          messageId
        );
      }

      /*
       * ======================================
       * LOCAL DEVELOPMENT
       * ======================================
       */

      else {
        console.log(
          `Sending email through Ethereal to ${recipient}`
        );

        const info =
          await transporter.sendMail({
            from:
              `"ReachInbox" <${process.env.ETHEREAL_USER}>`,

            to: recipient,

            subject,

            text: body,
          });

        messageId =
          info.messageId;

        previewUrl =
          nodemailer.getTestMessageUrl(
            info
          );

        console.log(
          "Email sent through Ethereal successfully!"
        );

        console.log(
          "Message ID:",
          info.messageId
        );

        console.log(
          "Preview URL:",
          previewUrl
        );
      }

      /*
       * ======================================
       * MARK AS SENT
       * ======================================
       */

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
        `Email ${emailId} marked as SENT`
      );

      return {
        success: true,

        messageId,

        previewUrl,
      };
    }

    catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown email sending error";

      console.error(
        `Email ${emailId} failed:`,
        errorMessage
      );

      /*
       * Save error in database
       */

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
      max:
        Number(
          process.env.WORKER_CONCURRENCY
        ) || 5,

      duration: 1000,
    },
  }
);

/*
 * ==========================================
 * COMPLETED
 * ==========================================
 */

emailWorker.on(
  "completed",
  (job) => {
    console.log(
      `Job ${job.id} completed`
    );
  }
);

/*
 * ==========================================
 * FAILED
 * ==========================================
 */

emailWorker.on(
  "failed",
  async (
    job,
    error
  ) => {
    if (!job) {
      return;
    }

    console.error(
      `Job ${job.id} failed:`,
      error.message
    );

    /*
     * Only mark FAILED after
     * all BullMQ attempts are exhausted.
     */

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
        }

        catch (dbError) {
          console.error(
            "Failed to update email status:",
            dbError
          );
        }
      }
    }
  }
);

/*
 * ==========================================
 * START
 * ==========================================
 */

console.log(
  "Email worker started"
);