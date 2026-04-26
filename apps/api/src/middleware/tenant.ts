import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";
import { cache } from "../db/redis.js";

/**
 * Extend Express's Request interface to add our tenant data.
 *
 * Why module augmentation instead of a custom Request type?
 * If we create CustomRequest, every route handler must import it.
 * Module augmentation extends the global Express.Request —
 * all route handlers get websiteId automatically with no extra imports.
 */
declare global {
  namespace Express {
    interface Request {
      websiteId: string;
    }
  }
}

/**
 * Tenant resolver middleware.
 *
 * Every API request must include X-Website-Id header.
 * This header identifies which client (tenant) is making the request.
 *
 * Flow:
 * 1. Read X-Website-Id from request header
 * 2. Validate it exists and is non-empty
 * 3. Attach it to req.websiteId for downstream handlers
 *
 * Phase 4 (Mongoose models) will extend this to:
 * - Look up the full Tenant document from MongoDB
 * - Validate the tenant is active
 * - Cache the tenant config in Redis
 */
export function tenantResolver(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const websiteId = req.headers["x-website-id"];

  if (!websiteId || typeof websiteId !== "string" || websiteId.trim() === "") {
    next(
      new AppError(
        400,
        "MISSING_WEBSITE_ID",
        "X-Website-Id header is required",
      ),
    );
    return;
  }

  // Attach to request object — available in all downstream handlers
  req.websiteId = websiteId.trim().toLowerCase();
  next();
}
