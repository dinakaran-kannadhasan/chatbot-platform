import Redis from "ioredis";
import { env } from "../config/env.js";

/**
 * In test environment we create a Redis instance with
 * lazyConnect: true so it does NOT connect on import.
 * Tests that need Redis will mock it entirely.
 * Tests that don't need Redis (HTTP layer tests) won't
 * be slowed down by connection retries.
 */
const isTest = env.NODE_ENV === "test";

export const redis = new Redis(process.env.REDIS_URL!, {
  lazyConnect: process.env.NODE_ENV === "test",
  maxRetriesPerRequest: null, // ← add this
  enableReadyCheck: false, // ← add this for Upstash TLS
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
});

// Only log connection events outside tests
if (!isTest) {
  redis.on("connect", () => console.log("✅ Redis connected"));
  redis.on("error", (error) => console.error("Redis error:", error));
  redis.on("close", () => console.warn("Redis connection closed"));
}

const KEY_PREFIX = "chatbot:";

export const cache = {
  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    const serialized = JSON.stringify(value);
    await redis.setex(`${KEY_PREFIX}${key}`, ttlSeconds, serialized);
  },

  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(`${KEY_PREFIX}${key}`);
    if (!value) return null;
    return JSON.parse(value) as T;
  },

  async del(key: string): Promise<void> {
    await redis.del(`${KEY_PREFIX}${key}`);
  },

  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(`${KEY_PREFIX}${key}`);
    return result === 1;
  },
};
