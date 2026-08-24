import IORedis from "ioredis";

const redisUrl =
  process.env.REDIS_URL ||
  "redis://localhost:6379";

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("ready", () => {
  console.log("Redis ready");
});

redis.on("error", (error) => {
  console.error("Redis error:", error);
});

export default redis;