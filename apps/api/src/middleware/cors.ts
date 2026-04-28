import cors from "cors";
import { env } from "../config/env.js";

/**
 * Why custom CORS instead of cors({ origin: '*' })?
 *
 * The chatbot widget is embedded on client websites.
 * We need to allow requests from:
 * 1. Our own frontend (localhost:3000 in dev, production URL)
 * 2. Any domain where the widget is embedded (tenant domains)
 *
 * Using '*' would work but is a security risk — any website
 * could call our API. We validate against a whitelist instead.
 *
 * In production, tenant domains come from the database.
 * For now we use a static list that we'll make dynamic in Phase 4.
 */

// Domains always allowed — our own apps
const ALWAYS_ALLOWED = [
  env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    // Read dynamically on each request — picks up env changes
    const allowedOrigins = [
      env.FRONTEND_URL,
      "http://localhost:3000",
      "http://localhost:3001",
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (env.NODE_ENV === "development") {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Website-Id"],
});
