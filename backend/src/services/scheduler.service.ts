import { emailQueue } from "../queues/email.queue";

interface ScheduleEmailInput {
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  senderId: string;
  hourlyLimit?: number | null;
}

export async function scheduleEmailJob(
  input: ScheduleEmailInput
) {
  const delay = Math.max(
    0,
    input.scheduledAt.getTime() - Date.now()
  );

  const job = await emailQueue.add(
    "send-email",
    {
      emailId: input.emailId,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      senderId: input.senderId,
      hourlyLimit: input.hourlyLimit,
    },
    {
      delay,

      // Unique job ID prevents duplicate queue jobs
      jobId: `email-${input.emailId}`,

      // Retry temporary failures
      attempts: 24,

      backoff: {
        type: "fixed",
        delay: 5 * 60 * 1000,
      },

      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  return job;
}