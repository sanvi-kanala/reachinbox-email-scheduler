import redis from "../config/redis";

export async function waitForSendSlot(
  senderId: string,
  delayMs: number
): Promise<void> {
  const key = `email-last-send:${senderId}`;

  while (true) {
    const now = Date.now();

    const nextAllowed = await redis.get(key);

    if (!nextAllowed) {
      return;
    }

    const remaining =
      Number(nextAllowed) - now;

    if (remaining <= 0) {
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, remaining)
    );
  }
}

export async function markEmailSent(
  senderId: string,
  delayMs: number
): Promise<void> {
  const key = `email-last-send:${senderId}`;

  const nextAllowedTime =
    Date.now() + delayMs;

  await redis.set(
    key,
    nextAllowedTime.toString(),
    "EX",
    3600
  );
}