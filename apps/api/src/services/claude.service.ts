import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import type { Message, StreamChunk, IntentLevel } from "@chatbot/types";

export { buildSystemPrompt } from "./prompt.service.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

const MODEL = "claude-sonnet-4-5";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "update_intent",
    description:
      "Update the user intent level based on the conversation. Call this when you detect the user is more interested than their current intent level suggests.",
    input_schema: {
      type: "object" as const,
      properties: {
        intent_level: {
          type: "string",
          enum: ["EXPLORING", "INTERESTED", "HIGH_INTENT"],
          description: "The new intent level for this user",
        },
        reason: {
          type: "string",
          description: "Brief reason for the intent update",
        },
      },
      required: ["intent_level", "reason"],
    },
  },
  {
    name: "capture_lead_info",
    description:
      "Capture lead information when the user provides their name, email, company, or use case naturally in conversation.",
    input_schema: {
      type: "object" as const,
      properties: {
        field: {
          type: "string",
          enum: [
            "name",
            "email",
            "company",
            "jobTitle",
            "useCase",
            "currentSolution",
          ],
          description: "Which lead field was just provided",
        },
        value: {
          type: "string",
          description: "The value the user provided",
        },
      },
      required: ["field", "value"],
    },
  },
];

export interface ClaudeStreamResult {
  fullText: string;
  intentUpdate?: { level: IntentLevel; reason: string };
  leadCapture?: { field: string; value: string };
}

export async function streamChatResponse(
  messages: Message[],
  systemPrompt: string,
  onChunk: (chunk: StreamChunk) => void,
): Promise<ClaudeStreamResult> {
  const anthropic = getClient();

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let fullText = "";
  let intentUpdate: ClaudeStreamResult["intentUpdate"];
  let leadCapture: ClaudeStreamResult["leadCapture"];

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: anthropicMessages,
    tools: TOOLS,
    tool_choice: { type: "auto" },
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const delta = event.delta.text;
      fullText += delta;
      onChunk({ delta, done: false });
    }
  }

  const finalMessage = await stream.finalMessage();

  for (const block of finalMessage.content) {
    if (block.type === "tool_use") {
      if (block.name === "update_intent") {
        const input = block.input as { intent_level: string; reason: string };
        intentUpdate = {
          level: input.intent_level as IntentLevel,
          reason: input.reason,
        };
      }
      if (block.name === "capture_lead_info") {
        const input = block.input as { field: string; value: string };
        leadCapture = { field: input.field, value: input.value };
      }
    }
  }

  onChunk({ delta: "", done: true, intentLevel: intentUpdate?.level });

  return { fullText, intentUpdate, leadCapture };
}
