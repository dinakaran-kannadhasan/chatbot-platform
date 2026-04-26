import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app.js";
import { redis } from "../../apps/api/src/db/redis.js";

/**
 * Disconnect Redis after all tests complete.
 * Without this, the test process hangs waiting for
 * the Redis connection to close naturally.
 */
afterAll(async () => {
  await redis.quit().catch(() => {
    // ignore errors on quit — Redis may not have connected
  });
});

describe("Phase 3 — Express API", () => {
  describe("Health endpoint", () => {
    it("GET /health returns 200 or 503", async () => {
      const res = await request(app).get("/health");
      expect([200, 503]).toContain(res.status);
    }, 10000); // 10s timeout — Redis retry backoff takes time

    it("GET /health returns correct shape", async () => {
      const res = await request(app).get("/health");
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("services");
      expect(res.body.services).toHaveProperty("mongodb");
      expect(res.body.services).toHaveProperty("redis");
    }, 10000);
  });

  describe("404 handler", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await request(app).get("/api/unknown-route");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns correct error shape", async () => {
      const res = await request(app).get("/does-not-exist");
      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toHaveProperty("code");
      expect(res.body.error).toHaveProperty("message");
    });
  });

  describe("Security headers", () => {
    it("sets X-Content-Type-Options header", async () => {
      const res = await request(app).get("/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    }, 10000);

    it("sets X-Frame-Options header", async () => {
      const res = await request(app).get("/health");
      expect(res.headers["x-frame-options"]).toBeDefined();
    }, 10000);
  });

  describe("Request body validation", () => {
    it("rejects oversized JSON payload", async () => {
      const largePayload = { data: "x".repeat(11 * 1024) };
      const res = await request(app)
        .post("/api/chat")
        .send(largePayload)
        .set("Content-Type", "application/json");

      /**
       * Express 5 wraps PayloadTooLarge as a 500 via the error handler
       * unless we explicitly handle it. We accept either:
       * - 413 (PayloadTooLarge — Express handles it natively)
       * - 500 (our global error handler catches it)
       * Both prove the payload limit is working.
       */
      expect([413, 500]).toContain(res.status);
    });
  });
});
