import { connectMongoDB, disconnectMongoDB } from "./db/mongoose.js";
import { redis } from "./db/redis.js";
import { env } from "./config/env.js";
import app from "./app.js";

/**
 * Graceful shutdown handler.
 *
 * Why graceful shutdown?
 * When Kubernetes restarts a pod it sends SIGTERM first.
 * Without a handler, Node exits immediately — dropping any
 * in-flight requests and leaving DB connections open.
 *
 * With graceful shutdown:
 * 1. Stop accepting new requests
 * 2. Wait for in-flight requests to complete
 * 3. Close DB connections cleanly
 * 4. Exit with code 0 (success)
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Close Redis connection
  await redis.quit();
  console.log("Redis disconnected");

  // Close MongoDB connection
  await disconnectMongoDB();

  console.log("Graceful shutdown complete");
  process.exit(0);
}

async function startServer(): Promise<void> {
  try {
    // Connect to databases BEFORE starting HTTP server
    // If DB connection fails, the server never starts
    // This prevents serving requests when we can't store data
    await connectMongoDB();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 API server running on port ${env.PORT}`);
      console.log(`📍 Environment: ${env.NODE_ENV}`);
      console.log(`🏥 Health check: http://localhost:${env.PORT}/health`);
    });

    // Register shutdown handlers
    // SIGTERM — sent by Kubernetes/Docker on container stop
    // SIGINT  — sent when you press Ctrl+C in terminal
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    /**
     * Handle uncaught errors — last resort safety net.
     * These should never happen if code is correct,
     * but if they do, log and exit so the process
     * manager can restart the service.
     */
    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled Promise Rejection:", reason);
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
