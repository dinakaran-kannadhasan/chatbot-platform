"use client";

import { useEffect, useCallback } from "react";
import { useChatStore } from "../../store/chatStore.js";
import { useChat } from "../../hooks/useChat.js";
import { MessageList } from "./MessageList.js";
import { InputBar } from "./InputBar.js";

interface ChatWidgetProps {
  websiteId: string;
  /**
   * primaryColor allows per-tenant branding.
   * Passed as a CSS variable so Tailwind classes
   * can reference it without hardcoding colors.
   */
  primaryColor?: string;
  botName?: string;
}

/**
 * ChatWidget — the top-level chat UI component.
 *
 * Renders in two states:
 * 1. Collapsed — floating button in bottom-right corner
 * 2. Expanded — full chat panel
 *
 * This component is the entry point for the widget.
 * It can be embedded in any React app or the standalone
 * Vite widget bundle (Phase 8).
 */
export function ChatWidget({
  websiteId,
  primaryColor = "#185fa5",
  botName = "AI Assistant",
}: ChatWidgetProps) {
  const { isOpen, setIsOpen, messages } = useChatStore();
  const { initSession, sendMessage } = useChat(websiteId);

  /**
   * Initialize session when widget first opens.
   * Why not on mount? The user hasn't interacted yet —
   * no need to create a session until they open the chat.
   * Lazy initialization saves DB writes and API calls.
   */
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      void initSession();
    }
  }, [isOpen, messages.length, initSession]);

  const handleToggle = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen, setIsOpen]);

  const handleSend = useCallback(
    (message: string) => {
      void sendMessage(message);
    },
    [sendMessage],
  );

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      style={{ "--brand-primary": primaryColor } as React.CSSProperties}
    >
      {/* Chat panel — conditionally rendered */}
      {isOpen && (
        <div className="w-[380px] h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between text-white shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
                AI
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{botName}</p>
                <p className="text-[11px] opacity-80 leading-tight">
                  Online · Typically replies instantly
                </p>
              </div>
            </div>
            <button
              onClick={handleToggle}
              aria-label="Close chat"
              className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <MessageList />

          {/* Input */}
          <InputBar onSend={handleSend} />
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={handleToggle}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
        style={{ backgroundColor: primaryColor }}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 4l12 12M16 4L4 16"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
