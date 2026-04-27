"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "../store/chatStore.js";
import type { StreamChunk, IntentLevel } from "@chatbot/types";

/**
 * useChat — the core hook that connects UI to the API.
 *
 * Responsibilities:
 * 1. Initialize a session when the widget opens
 * 2. Send messages to the API
 * 3. Parse the SSE stream and update the store
 * 4. Handle errors gracefully
 *
 * Why useRef for abortController?
 * We need to cancel in-flight requests when the component unmounts
 * or when the user sends a new message before the previous completes.
 * useRef persists across renders without causing re-renders.
 */
export function useChat(websiteId: string) {
  const {
    sessionToken,
    isStreaming,
    setSessionToken,
    addMessage,
    updateLastMessage,
    finalizeLastMessage,
    setIsStreaming,
    setIntentLevel,
    setNextQuestion,
    updateLeadData,
  } = useChatStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Initialize session — called once when widget first opens.
   * Creates a session on the backend and stores the token locally.
   */
  const initSession = useCallback(async () => {
    if (sessionToken) return; // Already initialized

    try {
      const response = await fetch("/api/chat/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Website-Id": websiteId,
        },
        body: JSON.stringify({
          pageUrl: window.location.pathname,
          referrer: document.referrer || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = (await response.json()) as {
        data: { sessionToken: string; welcomeMessage: string };
      };

      setSessionToken(data.data.sessionToken);

      // Add welcome message to chat
      addMessage({
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: data.data.welcomeMessage,
        timestamp: new Date(),
        isStreaming: false,
      });
    } catch (error) {
      console.error("Session init failed:", error);
    }
  }, [sessionToken, websiteId, setSessionToken, addMessage]);

  /**
   * Send a message and stream the response.
   *
   * SSE parsing:
   * The API sends lines like: data: {"delta":"Hello","done":false}\n\n
   * We split on \n, find lines starting with "data: ", parse the JSON,
   * and update the store with each delta.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionToken || isStreaming) return;

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Add user message immediately — feels responsive
      addMessage({
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        isStreaming: false,
      });

      // Add empty assistant message — will be filled by stream
      addMessage({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      });

      setIsStreaming(true);

      try {
        const response = await fetch("/api/chat/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Website-Id": websiteId,
          },
          body: JSON.stringify({ sessionToken, message: content }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Stream request failed");
        }

        /**
         * ReadableStream parsing for SSE.
         *
         * Why manual stream parsing instead of EventSource?
         * EventSource only supports GET requests.
         * We need POST to send the message body.
         * Manual fetch + ReadableStream is the correct approach
         * for POST-based SSE.
         */
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Keep incomplete last line in buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6); // Remove "data: " prefix
            if (!jsonStr.trim()) continue;

            try {
              const chunk = JSON.parse(jsonStr) as StreamChunk & {
                nextQuestion?: string;
                leadCaptured?: boolean;
              };

              if (!chunk.done && chunk.delta) {
                updateLastMessage(chunk.delta);
              }

              if (chunk.done) {
                finalizeLastMessage();
                if (chunk.intentLevel) {
                  setIntentLevel(chunk.intentLevel as IntentLevel);
                }
                if (chunk.nextQuestion) {
                  setNextQuestion(chunk.nextQuestion);
                }
              }
            } catch {
              // Skip malformed chunks — stream continues
            }
          }
        }
      } catch (error: unknown) {
        // AbortError is expected when we cancel — not a real error
        if (error instanceof Error && error.name === "AbortError") return;

        console.error("Stream error:", error);
        finalizeLastMessage();
      } finally {
        setIsStreaming(false);
      }
    },
    [
      sessionToken,
      isStreaming,
      websiteId,
      addMessage,
      updateLastMessage,
      finalizeLastMessage,
      setIsStreaming,
      setIntentLevel,
      setNextQuestion,
    ],
  );

  return { initSession, sendMessage, isStreaming, sessionToken };
}
