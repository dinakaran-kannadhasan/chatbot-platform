import { Router } from "express";
import type { Request, Response, Router as RouterType } from "express";
import { mongoose } from "../db/mongoose.js";
import { redis } from "../db/redis.js";

/**
 * Health check endpoint — critical for production.
 *
 * Why have a health route?
 * Docker, Kubernetes, and load balancers ping this endpoint
 * to know if the service is alive. If it returns non-200,
 * the container is restarted or taken out of rotation.
 *
 * We check both MongoDB and Redis — if either is down,
 * the service is degraded and should be flagged.
 */
const router: RouterType = Router();

router.get("/", async (_req: Request, res: Response) => {
  const mongoStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";

  let redisStatus = "disconnected";
  try {
    await redis.ping();
    redisStatus = "connected";
  } catch {
    redisStatus = "disconnected";
  }

  const isHealthy = mongoStatus === "connected" && redisStatus === "connected";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoStatus,
      redis: redisStatus,
    },
  });
});

export default router;
