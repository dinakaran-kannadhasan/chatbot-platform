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
    /**
     * origin is undefined for:
     * - Server-to-server requests (Postman, curl)
     * - Same-origin requests
     * Allow these without restriction.
     */
    if (!origin) {
      callback(null, true);
      return;
    }

    if (ALWAYS_ALLOWED.includes(origin)) {
      callback(null, true);
      return;
    }

    /**
     * TODO Phase 4: Query the Tenant collection to check
     * if this origin matches a registered tenant domain.
     * For now, allow all origins in development.
     */
    if (env.NODE_ENV === "development") {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },

  // Allow cookies and Authorization headers
  credentials: true,

  // Which HTTP methods the widget/frontend can use
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],

  // Which headers the client can send
  allowedHeaders: ["Content-Type", "Authorization", "X-Website-Id"],
});
