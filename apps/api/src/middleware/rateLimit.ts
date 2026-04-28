import rateLimit from "express-rate-limit";

/**
 * Fix 1: Use req.ip directly without custom keyGenerator.
 * express-rate-limit v8 requires using the built-in ipKeyGenerator
 * helper for custom keyGenerators that use IP addresses.
 * Simplest fix: remove the custom keyGenerator entirely and
 * use the default (IP-based) limiter. We add websiteId via
 * a custom store key prefix in a later phase when we add Redis store.
 *
 * Fix 2: skip limits in test environment entirely.
 * Rate limiters interfere with tests — multiple requests to the
 * same endpoint hit the limit and return 429 instead of expected codes.
 */

const isTest = process.env["NODE_ENV"] === "test";

export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 30,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many messages. Please wait a few minutes.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 100,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: false, // ← add this
  skip: () => process.env.NODE_ENV === "test",
});
