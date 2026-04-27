import { Router, type Request, type Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { tenantResolver } from "../middleware/tenant.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import { processMessage, createSession } from "../services/chat.service.js";
import type { StreamChunk } from "@chatbot/types";

const router: Router = Router();

/**
 * POST /api/chat/session
 * Creates a new chat session when the widget loads.
 *
 * Returns: sessionToken (stored in browser), welcomeMessage, branding
 */
router.post(
  "/session",
  tenantResolver,
  asyncHandler(async (req: Request, res: Response) => {
    const { referrer, pageUrl } = req.body as {
      referrer?: string;
      pageUrl?: string;
    };

    const result = await createSession(req.websiteId, {
      userAgent: req.headers["user-agent"] ?? "unknown",
      ipAddress: req.ip ?? "unknown",
      referrer,
      pageUrl: pageUrl ?? "/",
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

/**
 * POST /api/chat/message
 * Processes a user message and streams the AI response.
 *
 * Why SSE (Server-Sent Events) instead of WebSockets?
 * SSE is simpler — one-directional stream from server to client.
 * Chat is naturally one-directional: user sends, server streams back.
 * SSE works over standard HTTP — no upgrade handshake needed.
 * WebSockets are overkill for this use case.
 *
 * SSE format:
 * data: {"delta":"Hello","done":false}\n\n
 * data: {"delta":" there","done":false}\n\n
 * data: {"delta":"","done":true}\n\n
 */
router.post(
  "/message",
  tenantResolver,
  chatLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken, message } = req.body as {
      sessionToken?: string;
      message?: string;
    };

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new AppError(
        400,
        "MISSING_SESSION_TOKEN",
        "sessionToken is required",
      );
    }

    if (!message || typeof message !== "string" || message.trim() === "") {
      throw new AppError(400, "MISSING_MESSAGE", "message is required");
    }

    if (message.length > 2000) {
      throw new AppError(
        400,
        "MESSAGE_TOO_LONG",
        "message cannot exceed 2000 characters",
      );
    }

    /**
     * Set SSE headers before streaming starts.
     * These must be set before any data is written.
     *
     * Cache-Control: no-cache — prevents proxies caching the stream
     * X-Accel-Buffering: no — prevents Nginx buffering SSE chunks
     */
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    /**
     * onChunk callback — called for every streaming token.
     * We format as SSE and write directly to the response.
     *
     * Why JSON.stringify inside the SSE format?
     * The StreamChunk might contain characters like newlines
     * that would break the SSE format. JSON encoding is safe.
     */
    const onChunk = (chunk: StreamChunk) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    };

    const result = await processMessage({
      sessionToken,
      websiteId: req.websiteId,
      userMessage: message.trim(),
      onChunk,
    });

    /**
     * Send final metadata after the stream ends.
     * This tells the client the intent level and next question
     * without interrupting the stream mid-response.
     */
    res.write(
      `data: ${JSON.stringify({
        delta: "",
        done: true,
        intentLevel: result.intentLevel,
        nextQuestion: result.nextQuestion,
        leadCaptured: result.leadCaptured,
      })}\n\n`,
    );

    res.end();
  }),
);

export default router;
