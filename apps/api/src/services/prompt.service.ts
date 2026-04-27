import type { IntentLevel } from "@chatbot/types";

/**
 * Pure functions for building Claude prompts.
 * Separated from claude.service.ts so tests can import
 * these without triggering the Anthropic SDK mock.
 *
 * Pure function = no side effects, no API calls,
 * same input always produces same output.
 * These are trivially testable.
 */

export function buildSystemPrompt(
  tenantSystemPrompt: string,
  ragContext: string,
  sessionState: {
    intentLevel: IntentLevel;
    collectedFields: string[];
  },
): string {
  const { intentLevel, collectedFields } = sessionState;

  const uncollectedFields = ["name", "email", "company", "useCase"].filter(
    (f) => !collectedFields.includes(f),
  );

  return `${tenantSystemPrompt}

${ragContext ? ragContext : ""}

CURRENT SESSION STATE:
- User intent level: ${intentLevel}
- Lead fields still needed: ${uncollectedFields.length > 0 ? uncollectedFields.join(", ") : "all collected"}

RESPONSE GUIDELINES:
- Keep responses concise (2-4 sentences for simple questions)
- If the user shows HIGH_INTENT signals (pricing, demo, implementation), use the update_intent tool
- If the user mentions their name, email, company, or use case naturally, use the capture_lead_info tool
- Never ask for more than one piece of information at a time
- If you cannot answer from the provided context, say: "I couldn't find that on our website, but I can connect you with our team."
- Always end HIGH_INTENT responses with a demo booking suggestion`;
}
