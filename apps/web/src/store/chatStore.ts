import { create } from "zustand";
import type { Message, IntentLevel } from "@chatbot/types";

/**
 * Why Zustand over React Context?
 *
 * Context re-renders every consumer on every state change.
 * If messages update on every streaming token, Context would
 * re-render the entire component tree 50+ times per second.
 *
 * Zustand uses selective subscriptions — components only
 * re-render when the specific slice they subscribe to changes.
 * MessageList re-renders on messages change.
 * InputBar re-renders on isStreaming change.
 * They never cause each other to re-render unnecessarily.
 */

export interface ChatMessage extends Message {
  id: string; // Local ID for React key prop
  isStreaming?: boolean; // True while this message is being streamed
}

export interface LeadData {
  name?: string;
  email?: string;
  company?: string;
  useCase?: string;
}

interface ChatState {
  // Session
  sessionToken: string | null;
  websiteId: string;
  isOpen: boolean;

  // Messages
  messages: ChatMessage[];
  isStreaming: boolean;

  // Intent and lead
  intentLevel: IntentLevel;
  leadData: LeadData;
  nextQuestion: string | null;

  // Actions
  setSessionToken: (token: string) => void;
  setIsOpen: (open: boolean) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (delta: string) => void;
  finalizeLastMessage: () => void;
  setIsStreaming: (streaming: boolean) => void;
  setIntentLevel: (level: IntentLevel) => void;
  updateLeadData: (data: Partial<LeadData>) => void;
  setNextQuestion: (question: string | null) => void;
  reset: () => void;
}

const initialState = {
  sessionToken: null,
  websiteId: "",
  isOpen: false,
  messages: [],
  isStreaming: false,
  intentLevel: "EXPLORING" as IntentLevel,
  leadData: {},
  nextQuestion: null,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setSessionToken: (token) => set({ sessionToken: token }),

  setIsOpen: (open) => set({ isOpen: open }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  /**
   * updateLastMessage — appends a streaming delta to the last message.
   *
   * Why mutate the last message instead of adding a new one?
   * Each streaming token is a partial word — "Hello", " there", "!".
   * We want them to appear as one growing message, not 50 separate bubbles.
   * We find the last message and append the delta to its content.
   */
  updateLastMessage: (delta) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last) {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + delta,
        };
      }
      return { messages };
    }),

  finalizeLastMessage: () =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last) {
        messages[messages.length - 1] = { ...last, isStreaming: false };
      }
      return { messages };
    }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  setIntentLevel: (level) => set({ intentLevel: level }),

  updateLeadData: (data) =>
    set((state) => ({ leadData: { ...state.leadData, ...data } })),

  setNextQuestion: (question) => set({ nextQuestion: question }),

  reset: () => set(initialState),
}));
