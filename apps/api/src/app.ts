import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import { corsMiddleware } from "./middleware/cors.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.routes.js";
import chatRouter from "./routes/chat.routes.js";
import leadRouter from "./routes/lead.routes.js";
import tenantRouter from "./routes/tenant.routes.js";

const app: Express = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use("/api", apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
// In app.ts — add this before your other routes
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use("/health", healthRouter);
app.use("/api/chat", chatRouter);
app.use("/api/leads", leadRouter);
app.use("/api/tenants", tenantRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorHandler);

export default app;
