import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../../apps/web/src/store/chatStore.js";

/**
 * Frontend tests focus on the Zustand store logic.
 * Component rendering tests use React Testing Library —
 * we add those in Phase 9 (full test suite).
 *
 * Why test the store directly?
 * The store contains all the business logic for the UI:
 * - Message accumulation during streaming
 * - Intent level tracking
 * - Lead data collection
 *
 * These are pure state transitions — testable without
 * mounting any React components.
 */

describe("Phase 7 — ChatStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useChatStore.getState().reset();
  });

  describe("session management", () => {
    it("initializes with no session token", () => {
      expect(useChatStore.getState().sessionToken).toBeNull();
    });

    it("sets session token", () => {
      useChatStore.getState().setSessionToken("sess_abc123");
      expect(useChatStore.getState().sessionToken).toBe("sess_abc123");
    });

    it("initializes with widget closed", () => {
      expect(useChatStore.getState().isOpen).toBe(false);
    });

    it("toggles widget open state", () => {
      useChatStore.getState().setIsOpen(true);
      expect(useChatStore.getState().isOpen).toBe(true);
      useChatStore.getState().setIsOpen(false);
      expect(useChatStore.getState().isOpen).toBe(false);
    });
  });

  describe("message management", () => {
    it("starts with empty messages", () => {
      expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it("adds a message", () => {
      useChatStore.getState().addMessage({
        id: "msg_1",
        role: "user",
        content: "Hello",
        timestamp: new Date(),
        isStreaming: false,
      });
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0]?.content).toBe("Hello");
    });

    it("adds multiple messages in order", () => {
      useChatStore.getState().addMessage({
        id: "msg_1",
        role: "user",
        content: "Hello",
        timestamp: new Date(),
      });
      useChatStore.getState().addMessage({
        id: "msg_2",
        role: "assistant",
        content: "Hi there!",
        timestamp: new Date(),
      });
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe("user");
      expect(messages[1]?.role).toBe("assistant");
    });
  });

  describe("streaming behaviour", () => {
    it("accumulates streaming deltas on last message", () => {
      useChatStore.getState().addMessage({
        id: "msg_1",
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      });

      useChatStore.getState().updateLastMessage("Hello");
      useChatStore.getState().updateLastMessage(" there");
      useChatStore.getState().updateLastMessage("!");

      expect(useChatStore.getState().messages[0]?.content).toBe("Hello there!");
    });

    it("does not update previous messages during streaming", () => {
      useChatStore.getState().addMessage({
        id: "msg_1",
        role: "user",
        content: "Original",
        timestamp: new Date(),
      });
      useChatStore.getState().addMessage({
        id: "msg_2",
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      });

      useChatStore.getState().updateLastMessage("Response");

      const messages = useChatStore.getState().messages;
      expect(messages[0]?.content).toBe("Original");
      expect(messages[1]?.content).toBe("Response");
    });

    it("finalizes last message after stream ends", () => {
      useChatStore.getState().addMessage({
        id: "msg_1",
        role: "assistant",
        content: "Hello",
        timestamp: new Date(),
        isStreaming: true,
      });

      useChatStore.getState().finalizeLastMessage();
      expect(useChatStore.getState().messages[0]?.isStreaming).toBe(false);
    });

    it("tracks streaming state", () => {
      expect(useChatStore.getState().isStreaming).toBe(false);
      useChatStore.getState().setIsStreaming(true);
      expect(useChatStore.getState().isStreaming).toBe(true);
    });
  });

  describe("intent tracking", () => {
    it("starts at EXPLORING", () => {
      expect(useChatStore.getState().intentLevel).toBe("EXPLORING");
    });

    it("updates intent level", () => {
      useChatStore.getState().setIntentLevel("HIGH_INTENT");
      expect(useChatStore.getState().intentLevel).toBe("HIGH_INTENT");
    });
  });

  describe("lead data", () => {
    it("starts with empty lead data", () => {
      expect(useChatStore.getState().leadData).toEqual({});
    });

    it("updates lead data progressively", () => {
      useChatStore.getState().updateLeadData({ name: "Arun" });
      useChatStore.getState().updateLeadData({ email: "arun@test.com" });
      expect(useChatStore.getState().leadData).toEqual({
        name: "Arun",
        email: "arun@test.com",
      });
    });

    it("does not overwrite existing fields on partial update", () => {
      useChatStore
        .getState()
        .updateLeadData({ name: "Arun", email: "arun@test.com" });
      useChatStore.getState().updateLeadData({ company: "AppViewX" });
      expect(useChatStore.getState().leadData.name).toBe("Arun");
      expect(useChatStore.getState().leadData.email).toBe("arun@test.com");
      expect(useChatStore.getState().leadData.company).toBe("AppViewX");
    });
  });

  describe("next question", () => {
    it("starts with no next question", () => {
      expect(useChatStore.getState().nextQuestion).toBeNull();
    });

    it("sets next question", () => {
      useChatStore.getState().setNextQuestion("What is your company?");
      expect(useChatStore.getState().nextQuestion).toBe(
        "What is your company?",
      );
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", () => {
      useChatStore.getState().setSessionToken("tok_123");
      useChatStore.getState().setIsOpen(true);
      useChatStore.getState().setIntentLevel("HIGH_INTENT");
      useChatStore.getState().addMessage({
        id: "msg_1",
        role: "user",
        content: "Hello",
        timestamp: new Date(),
      });

      useChatStore.getState().reset();

      const state = useChatStore.getState();
      expect(state.sessionToken).toBeNull();
      expect(state.isOpen).toBe(false);
      expect(state.intentLevel).toBe("EXPLORING");
      expect(state.messages).toHaveLength(0);
    });
  });
});
