import redis from "../config/redis";

export async function checkRateLimit(
  senderId: string,
  hourlyLimit: number
): Promise<number> {
  const currentHour = new Date();
  currentHour.setMinutes(0, 0, 0);

  const hourKey = currentHour.toISOString();

  const key = `email-rate:${senderId}:${hourKey}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60 * 60);
  }

  // Email is allowed
  if (count <= hourlyLimit) {
    return 0;
  }

  // We exceeded the limit.
  // Undo the increment because this email hasn't been sent.
  await redis.decr(key);

  // Return the beginning of the next hour.
  const nextHour = new Date(
    currentHour.getTime() + 60 * 60 * 1000
  );

  return nextHour.getTime();
}