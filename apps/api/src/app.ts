import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import { corsMiddleware } from "./middleware/cors.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.routes.js";

/**
 * Why separate app.ts from server.ts?
 *
 * app.ts creates and configures the Express application.
 * server.ts starts the HTTP server on a port.
 *
 * This separation means tests can import app.ts directly
 * and use supertest without starting a real HTTP server.
 * Tests are faster and don't conflict on ports.
 */

// Explicitly type app as Express so TypeScript can name it
// in declaration files without reaching into node_modules
const app: Express = express();

// ─── Security Middleware ──────────────────────────────────────────────────────

/**
 * helmet() sets 14 security-related HTTP headers:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: SAMEORIGIN
 * - Strict-Transport-Security (HSTS)
 * - Content-Security-Policy
 * and more. One line replaces a week of security config.
 */
app.use(helmet());

// CORS must come before routes
app.use(corsMiddleware);

// ─── Body Parsing ─────────────────────────────────────────────────────────────

/**
 * express.json() parses incoming JSON request bodies.
 * limit: '10kb' prevents large payload attacks.
 * A chat message is never 10kb — if it is, it's an attack.
 */
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

// Apply general rate limit to all /api routes
app.use("/api", apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/health", healthRouter);

/**
 * Phase 4+ routes will be added here:
 * app.use('/api/chat', chatRouter);
 * app.use('/api/leads', leadRouter);
 * app.use('/api/tenants', tenantRouter);
 */

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

// Must be registered LAST — after all routes
app.use(errorHandler);

export default app;
