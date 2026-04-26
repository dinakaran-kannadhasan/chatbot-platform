import mongoose from "mongoose";
import { env } from "../config/env.js";

/**
 * Why a separate connection module instead of connecting in server.ts?
 *
 * 1. Testability — tests can import this and connect to a test DB
 * 2. Reusability — if we add workers or scripts, they import this
 * 3. Single responsibility — server.ts starts the HTTP server,
 *    this file manages the DB connection
 */

// Track connection state to avoid multiple connection attempts
let isConnected = false;

export async function connectMongoDB(): Promise<void> {
  // Guard against calling connect() multiple times
  // This matters in tests where connect is called per test file
  if (isConnected) {
    return;
  }

  try {
    /**
     * Mongoose connection options explained:
     *
     * maxPoolSize: 10
     * MongoDB uses a connection pool — multiple connections
     * ready to handle requests. 10 is the production default.
     * Too low = bottleneck. Too high = DB overwhelmed.
     *
     * serverSelectionTimeoutMS: 5000
     * How long Mongoose waits to find a MongoDB server.
     * 5 seconds is enough — fail fast if DB is unreachable.
     *
     * socketTimeoutMS: 45000
     * How long to wait for a response on an established connection.
     * 45 seconds handles slow aggregation queries.
     */
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log("✅ MongoDB connected");

    // Handle connection events after initial connect
    mongoose.connection.on("error", (error) => {
      console.error("MongoDB connection error:", error);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting reconnect...");
      isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
      isConnected = true;
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    // Re-throw so server.ts can handle the failure
    // The server should not start if DB is unavailable
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log("MongoDB disconnected gracefully");
}

/**
 * Export the mongoose instance for use in models.
 * Models import mongoose directly from the package,
 * but this export is useful for tests that need to
 * drop collections or check connection state.
 */
export { mongoose };
