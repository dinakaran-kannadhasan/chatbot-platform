import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyMessage,
  resolveSessionIntent,
  getNextLeadQuestion,
} from "../../apps/api/src/services/intent.service.js";
import { buildSystemPrompt } from "../../apps/api/src/services/prompt.service.js";
import { formatContext } from "../../apps/api/src/services/rag.service.js";
import type { Message } from "@chatbot/types";
import type { RagChunk } from "../../apps/api/src/services/rag.service.js";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      stream: vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello" },
          };
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: " there!" },
          };
        },
        finalMessage: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Hello there!" }],
        }),
      }),
    },
    post: vi.fn().mockResolvedValue({
      data: [{ embedding: new Array(1024).fill(0.1) }],
    }),
  })),
}));

vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: vi.fn().mockImplementation(() => ({
    index: vi.fn().mockReturnValue({
      namespace: vi.fn().mockReturnValue({
        query: vi.fn().mockResolvedValue({ matches: [] }),
        upsert: vi.fn().mockResolvedValue({}),
      }),
    }),
  })),
}));

describe("Phase 5 — IntentService", () => {
  describe("classifyMessage", () => {
    it("classifies pricing questions as HIGH_INTENT", () => {
      expect(classifyMessage("What is the pricing for enterprise?")).toBe(
        "HIGH_INTENT",
      );
    });

    it("classifies demo requests as HIGH_INTENT", () => {
      expect(classifyMessage("Can I get a demo?")).toBe("HIGH_INTENT");
    });

    it("classifies competitor questions as HIGH_INTENT", () => {
      expect(classifyMessage("How do you compare vs Venafi?")).toBe(
        "HIGH_INTENT",
      );
    });

    it("classifies feature questions as INTERESTED", () => {
      expect(classifyMessage("What features does it have?")).toBe("INTERESTED");
    });

    it("classifies PKI questions as INTERESTED", () => {
      expect(classifyMessage("How does PKI automation work?")).toBe(
        "INTERESTED",
      );
    });

    it("classifies general questions as EXPLORING", () => {
      expect(classifyMessage("Hello, what do you do?")).toBe("EXPLORING");
    });

    it("is case insensitive", () => {
      expect(classifyMessage("WHAT IS THE PRICING?")).toBe("HIGH_INTENT");
    });
  });

  describe("resolveSessionIntent", () => {
    it("returns current intent when no messages", () => {
      expect(resolveSessionIntent([], "EXPLORING")).toBe("EXPLORING");
    });

    it("upgrades intent based on messages", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: "What is the pricing?",
          timestamp: new Date(),
        },
      ];
      expect(resolveSessionIntent(messages, "EXPLORING")).toBe("HIGH_INTENT");
    });

    it("never downgrades intent", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello", timestamp: new Date() },
      ];
      expect(resolveSessionIntent(messages, "HIGH_INTENT")).toBe("HIGH_INTENT");
    });

    it("ignores assistant messages for intent", () => {
      const messages: Message[] = [
        {
          role: "assistant",
          content: "What is the pricing?",
          timestamp: new Date(),
        },
      ];
      expect(resolveSessionIntent(messages, "EXPLORING")).toBe("EXPLORING");
    });

    it("takes highest intent across all messages", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: "Tell me about features",
          timestamp: new Date(),
        },
        {
          role: "user",
          content: "What is the pricing?",
          timestamp: new Date(),
        },
        { role: "user", content: "Hello", timestamp: new Date() },
      ];
      expect(resolveSessionIntent(messages, "EXPLORING")).toBe("HIGH_INTENT");
    });
  });

  describe("getNextLeadQuestion", () => {
    it("asks for name first when nothing collected", () => {
      const q = getNextLeadQuestion([], "EXPLORING");
      expect(q).toContain("name");
    });

    it("asks for email after name is collected", () => {
      const q = getNextLeadQuestion(["name"], "EXPLORING");
      expect(q).toContain("email");
    });

    it("asks for company only when INTERESTED or higher", () => {
      const q = getNextLeadQuestion(["name", "email"], "INTERESTED");
      expect(q).toContain("company");
    });

    it("does not ask for company when only EXPLORING", () => {
      const q = getNextLeadQuestion(["name", "email"], "EXPLORING");
      expect(q).toBeNull();
    });

    it("suggests demo when all fields collected and HIGH_INTENT", () => {
      const allFields = [
        "name",
        "email",
        "company",
        "useCase",
        "currentSolution",
      ];
      const q = getNextLeadQuestion(allFields, "HIGH_INTENT");
      expect(q).toContain("demo");
    });
  });
});

describe("Phase 5 — ClaudeService (prompt builder)", () => {
  describe("buildSystemPrompt", () => {
    it("includes tenant system prompt", () => {
      const prompt = buildSystemPrompt("You are AVX Assistant.", "", {
        intentLevel: "EXPLORING",
        collectedFields: [],
      });
      expect(prompt).toContain("You are AVX Assistant.");
    });

    it("includes RAG context when provided", () => {
      const prompt = buildSystemPrompt(
        "You are AVX Assistant.",
        "RELEVANT CONTEXT: AppViewX automates PKI.",
        { intentLevel: "EXPLORING", collectedFields: [] },
      );
      expect(prompt).toContain("RELEVANT CONTEXT");
    });

    it("includes current intent level", () => {
      const prompt = buildSystemPrompt("You are AVX Assistant.", "", {
        intentLevel: "HIGH_INTENT",
        collectedFields: [],
      });
      expect(prompt).toContain("HIGH_INTENT");
    });

    it("lists uncollected lead fields", () => {
      const prompt = buildSystemPrompt("You are AVX Assistant.", "", {
        intentLevel: "EXPLORING",
        collectedFields: ["name", "email"],
      });
      // company and useCase should be listed as still needed
      expect(prompt).toContain("company");
      expect(prompt).toContain("useCase");
      // name and email should NOT appear in the "fields still needed" line
      expect(prompt).toContain("Lead fields still needed: company, useCase");
    });

    it("shows all collected when nothing left", () => {
      const prompt = buildSystemPrompt("You are AVX Assistant.", "", {
        intentLevel: "HIGH_INTENT",
        collectedFields: ["name", "email", "company", "useCase"],
      });
      expect(prompt).toContain("all collected");
    });
  });
});

describe("Phase 5 — RagService", () => {
  describe("formatContext", () => {
    it("returns empty string for no chunks", () => {
      expect(formatContext([])).toBe("");
    });

    it("formats chunks with source labels", () => {
      const chunks: RagChunk[] = [
        {
          id: "1",
          content: "AppViewX automates PKI lifecycle.",
          score: 0.95,
          metadata: {
            url: "https://appviewx.com/products",
            title: "Products",
            section: "PKI",
          },
        },
      ];
      const formatted = formatContext(chunks);
      expect(formatted).toContain("Source 1");
      expect(formatted).toContain("Products");
      expect(formatted).toContain("AppViewX automates PKI lifecycle.");
    });

    it("formats multiple chunks with separators", () => {
      const chunks: RagChunk[] = [
        {
          id: "1",
          content: "Content A",
          score: 0.95,
          metadata: { url: "https://a.com", title: "A", section: "A" },
        },
        {
          id: "2",
          content: "Content B",
          score: 0.85,
          metadata: { url: "https://b.com", title: "B", section: "B" },
        },
      ];
      const formatted = formatContext(chunks);
      expect(formatted).toContain("Source 1");
      expect(formatted).toContain("Source 2");
      expect(formatted).toContain("---");
    });

    it("includes fallback instruction", () => {
      const chunks: RagChunk[] = [
        {
          id: "1",
          content: "Content",
          score: 0.9,
          metadata: { url: "https://a.com", title: "A", section: "A" },
        },
      ];
      const formatted = formatContext(chunks);
      expect(formatted).toContain("If the answer is not in the context");
    });
  });
});
