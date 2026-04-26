import type { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "@chatbot/types";
import { env } from "../config/env.js";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    this.name = "AppError";
  }
}

export function errorHandler(
  error: Error & { type?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("Error:", {
    name: error.name,
    message: error.message,
    stack: env.NODE_ENV === "development" ? error.stack : undefined,
  });

  // Handle PayloadTooLarge from express.json()
  if (error.type === "entity.too.large") {
    res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the 10kb limit",
      },
    });
    return;
  }

  if (error instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: env.NODE_ENV === "development" ? error.stack : undefined,
      },
    };
    res.status(error.statusCode).json(response);
    return;
  }

  if (error.name === "ValidationError") {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: error.message },
    });
    return;
  }

  if (error.name === "JsonWebTokenError") {
    res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Invalid authentication token" },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "development"
          ? error.message
          : "An unexpected error occurred",
    },
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
