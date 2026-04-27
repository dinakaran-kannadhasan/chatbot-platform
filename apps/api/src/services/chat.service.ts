import type { Message, IntentLevel, StreamChunk } from "@chatbot/types";
import { SessionModel } from "../models/index.js";
import { LeadModel } from "../models/index.js";
import { TenantModel } from "../models/index.js";
import { streamChatResponse, buildSystemPrompt } from "./claude.service.js";
import { retrieveContext, formatContext } from "./rag.service.js";
import { resolveSessionIntent, getNextLeadQuestion } from "./intent.service.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * Chat service — the orchestrator.
 *
 * This is the only service that knows about all the others.
 * It coordinates the full flow for each message:
 *
 * 1. Validate session exists and belongs to tenant
 * 2. Retrieve relevant context via RAG
 * 3. Build the system prompt (tenant prompt + RAG context + state)
 * 4. Stream Claude's response
 * 5. Handle tool calls (intent update, lead capture)
 * 6. Persist updated session to MongoDB
 * 7. Push lead to Marketo if HIGH_INTENT
 *
 * Why is this a separate service from claude.service.ts?
 * claude.service.ts only knows about Claude — it takes messages,
 * returns text and tool calls. It has no knowledge of MongoDB,
 * sessions, leads, or Marketo.
 * chat.service.ts knows the business logic — it orchestrates
 * everything around the Claude call.
 * This separation means you can swap Claude for another AI
 * by only changing claude.service.ts.
 */
export interface ProcessMessageOptions {
  sessionToken: string;
  websiteId: string;
  userMessage: string;
  onChunk: (chunk: StreamChunk) => void;
}

export interface ProcessMessageResult {
  sessionId: string;
  intentLevel: IntentLevel;
  leadCaptured: boolean;
  nextQuestion: string | null;
}

export async function processMessage(
  options: ProcessMessageOptions,
): Promise<ProcessMessageResult> {
  const { sessionToken, websiteId, userMessage, onChunk } = options;

  // ─── 1. Validate session ───────────────────────────────────────────────────

  const session = await SessionModel.findByToken(sessionToken);
  if (!session) {
    throw new AppError(
      404,
      "SESSION_NOT_FOUND",
      "Session not found or expired",
    );
  }

  if (session.websiteId !== websiteId) {
    throw new AppError(
      403,
      "SESSION_MISMATCH",
      "Session does not belong to this website",
    );
  }

  // ─── 2. Load tenant config ────────────────────────────────────────────────

  const tenant = await TenantModel.findByWebsiteId(websiteId);
  if (!tenant || !tenant.isActive) {
    throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found or inactive");
  }

  // ─── 3. Add user message to history ──────────────────────────────────────

  const userMsg: Message = {
    role: "user",
    content: userMessage,
    timestamp: new Date(),
  };

  session.messages.push(userMsg);

  // ─── 4. Retrieve RAG context (if enabled for this tenant) ─────────────────

  let ragContext = "";
  if (tenant.settings.ragEnabled) {
    try {
      const chunks = await retrieveContext(userMessage, websiteId);
      ragContext = formatContext(chunks);
    } catch (error) {
      /**
       * RAG failure is non-fatal.
       * If Pinecone is down, Claude answers from its training knowledge.
       * The bot degrades gracefully — it doesn't crash.
       * This is the "partial failure" resilience pattern.
       */
      console.warn("RAG retrieval failed, continuing without context:", error);
    }
  }

  // ─── 5. Determine current lead fields collected ───────────────────────────

  const existingLead = session.leadId
    ? await LeadModel.findBySession(
        (session._id as unknown as string).toString(),
      )
    : null;

  const collectedFields = existingLead
    ? Object.entries({
        name: existingLead.name,
        email: existingLead.email,
        company: existingLead.company,
        useCase: existingLead.useCase,
        currentSolution: existingLead.currentSolution,
      })
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k)
    : [];

  // ─── 6. Build system prompt ───────────────────────────────────────────────

  const systemPrompt = buildSystemPrompt(tenant.systemPrompt, ragContext, {
    intentLevel: session.intentLevel,
    collectedFields,
  });

  // ─── 7. Stream Claude response ────────────────────────────────────────────

  const result = await streamChatResponse(
    session.messages,
    systemPrompt,
    onChunk,
  );

  // ─── 8. Add assistant response to session ─────────────────────────────────

  const assistantMsg: Message = {
    role: "assistant",
    content: result.fullText,
    timestamp: new Date(),
  };

  session.messages.push(assistantMsg);

  // ─── 9. Update intent level ───────────────────────────────────────────────

  /**
   * Intent comes from two sources:
   * a) Claude's tool call (explicit signal from the AI)
   * b) Keyword analysis of the full message history
   *
   * We take the highest of the two — never downgrade.
   */
  const toolIntent = result.intentUpdate?.level;
  const keywordIntent = resolveSessionIntent(
    session.messages,
    session.intentLevel,
  );

  const INTENT_RANK: Record<IntentLevel, number> = {
    EXPLORING: 0,
    INTERESTED: 1,
    HIGH_INTENT: 2,
  };

  if (
    toolIntent &&
    INTENT_RANK[toolIntent] > INTENT_RANK[session.intentLevel]
  ) {
    session.intentLevel = toolIntent;
  }
  if (INTENT_RANK[keywordIntent] > INTENT_RANK[session.intentLevel]) {
    session.intentLevel = keywordIntent;
  }

  // ─── 10. Handle lead capture ──────────────────────────────────────────────

  let leadCaptured = false;

  if (result.leadCapture && tenant.settings.collectLeads) {
    const { field, value } = result.leadCapture;

    if (field === "email" || (existingLead && field !== "email")) {
      try {
        if (!existingLead && field === "email") {
          /**
           * First time we capture email — create the lead document.
           * We use a placeholder name until we capture the real one.
           */
          const newLead = await LeadModel.create({
            sessionId: session._id.toString(),
            websiteId,
            name: "Unknown",
            email: value,
            intentLevel: session.intentLevel,
            status: "NEW",
          });
          session.leadId = newLead.id as string;
          leadCaptured = true;
        } else if (existingLead) {
          // Update existing lead with new field
          await LeadModel.findByIdAndUpdate(existingLead._id, {
            [field]: value,
            intentLevel: session.intentLevel,
          });
          leadCaptured = true;
        }
      } catch (error) {
        // Lead capture failure is also non-fatal
        console.warn("Lead capture failed:", error);
      }
    }
  }

  // ─── 11. Save session ─────────────────────────────────────────────────────

  await session.save();

  // ─── 12. Determine next question ──────────────────────────────────────────

  const nextQuestion = tenant.settings.collectLeads
    ? getNextLeadQuestion(collectedFields, session.intentLevel)
    : null;

  return {
    sessionId: session._id.toString(),
    intentLevel: session.intentLevel,
    leadCaptured,
    nextQuestion,
  };
}

/**
 * Create a new chat session.
 * Called when the widget first loads on a website.
 */
export async function createSession(
  websiteId: string,
  metadata: {
    userAgent: string;
    ipAddress: string;
    referrer?: string;
    pageUrl: string;
  },
): Promise<{ sessionToken: string; welcomeMessage: string }> {
  const tenant = await TenantModel.findByWebsiteId(websiteId);
  if (!tenant || !tenant.isActive) {
    throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found or inactive");
  }

  /**
   * crypto.randomUUID() is built into Node 20.
   * No external library needed for UUID generation.
   */
  const { randomUUID } = await import("crypto");
  const sessionToken = `sess_${randomUUID()}`;

  await SessionModel.create({
    websiteId,
    sessionToken,
    messages: [],
    intentLevel: "EXPLORING",
    metadata,
  });

  return {
    sessionToken,
    welcomeMessage: tenant.branding.welcomeMessage,
  };
}
