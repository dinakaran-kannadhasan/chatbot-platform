"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "../../store/chatStore.js";
import { TypingIndicator } from "./TypingIndicator.js";

/**
 * MessageList renders the conversation history.
 *
 * Why useRef for scroll?
 * We auto-scroll to the bottom on every new message/token.
 * useRef gives us direct DOM access without causing re-renders.
 * scrollIntoView() is a DOM imperative — not a React concern.
 */
export function MessageList() {
  const { messages, isStreaming } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or stream updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {message.role === "assistant" && (
            /**
             * Bot avatar — small colored circle with initials.
             * Positioned beside the message bubble.
             */
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-medium mr-2 mt-auto mb-0.5 shrink-0">
              AI
            </div>
          )}

          <div
            className={
              message.role === "user"
                ? "chat-bubble-user"
                : "chat-bubble-assistant"
            }
          >
            {message.content}
            {/**
             * Blinking cursor while streaming.
             * CSS animation on a pseudo-element — pure visual,
             * no JavaScript required.
             */}
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      ))}

      {/**
       * Show typing indicator when streaming starts
       * but before the first delta arrives.
       * This prevents a blank assistant bubble flicker.
       */}
      {isStreaming && messages[messages.length - 1]?.content === "" && (
        <div className="flex justify-start">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-medium mr-2 mt-auto mb-0.5 shrink-0">
            AI
          </div>
          <TypingIndicator />
        </div>
      )}

      {/* Invisible div at bottom — scroll target */}
      <div ref={bottomRef} />
    </div>
  );
}
