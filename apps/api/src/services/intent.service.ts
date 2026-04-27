import type { IntentLevel, Message } from "@chatbot/types";

/**
 * Intent classification rules.
 *
 * Why keyword-based instead of asking Claude to classify?
 * Two reasons:
 * 1. Speed — no extra API call per message
 * 2. Cost — every Claude call costs money
 *
 * Keyword matching handles 90% of cases correctly.
 * Claude updates the intent via tool_use in chat.service.ts
 * for edge cases where keywords aren't enough.
 *
 * This is the "cheap check first, expensive check only when needed"
 * engineering pattern — always apply it before making API calls.
 */

const HIGH_INTENT_KEYWORDS = [
  "pricing",
  "price",
  "cost",
  "demo",
  "trial",
  "buy",
  "purchase",
  "integrate",
  "integration",
  "implement",
  "implementation",
  "competitor",
  "vs ",
  "versus",
  "compare",
  "scale",
  "scalability",
  "enterprise",
  "contract",
  "quote",
];

const INTERESTED_KEYWORDS = [
  "feature",
  "features",
  "how does",
  "how do",
  "can it",
  "does it",
  "support",
  "capability",
  "capabilities",
  "benefit",
  "benefits",
  "use case",
  "use-case",
  "automate",
  "automation",
  "manage",
  "certificate",
  "pki",
  "ssl",
  "tls",
  "security",
];

/**
 * Classify a single message into an intent level.
 *
 * Why check HIGH_INTENT first?
 * If a message matches both INTERESTED and HIGH_INTENT keywords,
 * the higher intent wins. We never downgrade intent within a session.
 */
export function classifyMessage(content: string): IntentLevel {
  const lower = content.toLowerCase();

  const isHighIntent = HIGH_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
  if (isHighIntent) return "HIGH_INTENT";

  const isInterested = INTERESTED_KEYWORDS.some((kw) => lower.includes(kw));
  if (isInterested) return "INTERESTED";

  return "EXPLORING";
}

/**
 * Resolve the session's overall intent level from all messages.
 *
 * Why keep the highest intent seen, not just the latest?
 * A user who asked about pricing (HIGH_INTENT) and then asks
 * a general question doesn't become less interested.
 * Intent only ever goes UP — never down in a session.
 *
 * The precedence: HIGH_INTENT > INTERESTED > EXPLORING
 */
export function resolveSessionIntent(
  messages: Message[],
  currentIntent: IntentLevel,
): IntentLevel {
  const INTENT_RANK: Record<IntentLevel, number> = {
    EXPLORING: 0,
    INTERESTED: 1,
    HIGH_INTENT: 2,
  };

  let highestRank = INTENT_RANK[currentIntent];

  for (const message of messages) {
    if (message.role !== "user") continue;
    const messageIntent = classifyMessage(message.content);
    const messageRank = INTENT_RANK[messageIntent];
    if (messageRank > highestRank) {
      highestRank = messageRank;
    }
  }

  const intentByRank: IntentLevel[] = [
    "EXPLORING",
    "INTERESTED",
    "HIGH_INTENT",
  ];
  return intentByRank[highestRank] ?? "EXPLORING";
}

/**
 * Get the next question to ask based on intent level.
 *
 * Why a function instead of hardcoded strings in the prompt?
 * The next question logic can evolve independently of the AI prompt.
 * We can A/B test different questions without touching the prompt.
 */
export function getNextLeadQuestion(
  collectedFields: string[],
  intentLevel: IntentLevel,
): string | null {
  // Questions ordered by priority — most important first
  const questions: Array<{
    field: string;
    question: string;
    minIntent: IntentLevel;
  }> = [
    {
      field: "name",
      question: "I'd love to help you better — could I get your name?",
      minIntent: "EXPLORING",
    },
    {
      field: "email",
      question: "What's your work email so I can send you relevant resources?",
      minIntent: "EXPLORING",
    },
    {
      field: "company",
      question: "Which company are you with?",
      minIntent: "INTERESTED",
    },
    {
      field: "useCase",
      question:
        "What's your primary use case — certificate lifecycle management, PKI automation, or something else?",
      minIntent: "INTERESTED",
    },
    {
      field: "currentSolution",
      question: "What solution are you currently using to manage this?",
      minIntent: "HIGH_INTENT",
    },
  ];

  const INTENT_RANK: Record<IntentLevel, number> = {
    EXPLORING: 0,
    INTERESTED: 1,
    HIGH_INTENT: 2,
  };

  for (const q of questions) {
    const notCollected = !collectedFields.includes(q.field);
    const intentMet = INTENT_RANK[intentLevel] >= INTENT_RANK[q.minIntent];
    if (notCollected && intentMet) {
      return q.question;
    }
  }

  // All questions answered — suggest demo for high intent
  if (intentLevel === "HIGH_INTENT") {
    return "Based on what you've shared, I think a personalized demo would be perfect. Would you like to book one?";
  }

  return null;
}
