import { create } from "zustand";
import type { IntentLevel } from "@chatbot/types";

/**
 * Separate store from apps/web.
 *
 * Why not share the store from @chatbot/web?
 * The widget is a completely standalone bundle.
 * It cannot import from apps/web — that would create
 * a circular dependency and bundle Next.js into the widget.
 *
 * The widget store is intentionally minimal —
 * only what the embedded widget needs.
 */
export interface WidgetMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface WidgetState {
  isOpen: boolean;
  sessionToken: string | null;
  messages: WidgetMessage[];
  isStreaming: boolean;
  intentLevel: IntentLevel;
  nextQuestion: string | null;

  setIsOpen: (open: boolean) => void;
  setSessionToken: (token: string) => void;
  addMessage: (msg: WidgetMessage) => void;
  updateLastMessage: (delta: string) => void;
  finalizeLastMessage: () => void;
  setIsStreaming: (v: boolean) => void;
  setIntentLevel: (level: IntentLevel) => void;
  setNextQuestion: (q: string | null) => void;
}

export const useWidgetStore = create<WidgetState>((set) => ({
  isOpen: false,
  sessionToken: null,
  messages: [],
  isStreaming: false,
  intentLevel: "EXPLORING",
  nextQuestion: null,

  setIsOpen: (open) => set({ isOpen: open }),
  setSessionToken: (token) => set({ sessionToken: token }),

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

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

  setIsStreaming: (v) => set({ isStreaming: v }),
  setIntentLevel: (level) => set({ intentLevel: level }),
  setNextQuestion: (q) => set({ nextQuestion: q }),
}));
