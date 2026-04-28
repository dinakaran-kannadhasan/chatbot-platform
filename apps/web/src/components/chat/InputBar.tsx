"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore } from "../../store/chatStore";

interface InputBarProps {
  onSend: (message: string) => void;
}

/**
 * InputBar — the message input and send button.
 *
 * Why a textarea instead of input[type=text]?
 * Chat messages can be multi-line.
 * Textarea auto-expands to fit content — better UX.
 * We cap it at 4 rows to keep the layout stable.
 *
 * Why track value in local state instead of the store?
 * The input value is transient — it only matters while typing.
 * Once sent, it's cleared. Local state is simpler here.
 * The store holds sent messages — not the draft.
 */
export function InputBar({ onSend }: InputBarProps) {
  const [value, setValue] = useState("");
  const { isStreaming } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, onSend]);

  /**
   * Auto-resize textarea as user types.
   * scrollHeight = content height.
   * We set height to auto first to shrink when text is deleted,
   * then set to scrollHeight to expand when text is added.
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`; // max 4 rows
  };

  /**
   * Enter to send, Shift+Enter for new line.
   * This is the standard chat convention.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = value.trim() === "";

  return (
    <div className="border-t border-gray-100 p-3 bg-white">
      <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isStreaming}
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-gray-800 placeholder-gray-400 outline-none leading-5 min-h-[20px] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isEmpty || isStreaming}
          aria-label="Send message"
          className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-700 active:scale-95 transition-all shrink-0"
        >
          {/* Send arrow icon — pure SVG, no icon library needed */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 7h12M7 1l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-1.5">
        Powered by AppViewX · Press Enter to send
      </p>
    </div>
  );
}
