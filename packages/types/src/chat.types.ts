import type { BaseDocument } from "./common.types.js";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export type IntentLevel = "EXPLORING" | "INTERESTED" | "HIGH_INTENT";

export interface Session extends BaseDocument {
  websiteId: string;
  sessionToken: string;
  messages: Message[];
  intentLevel: IntentLevel;
  leadId?: string;
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  userAgent: string;
  ipAddress: string;
  referrer?: string;
  pageUrl: string;
  resolvedAt?: Date;
}

export interface SendMessageInput {
  content: string;
  sessionToken: string;
  websiteId: string;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  intentLevel?: IntentLevel;
}

// Re-export RagChunk for use in tests and other packages
export interface RagChunk {
  id: string;
  content: string;
  score: number;
  metadata: {
    url: string;
    title: string;
    section: string;
  };
}
