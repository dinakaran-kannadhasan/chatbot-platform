import { useEffect, useCallback, useRef } from "react";
import { useWidgetStore } from "./store/widgetStore.js";
import type { StreamChunk, IntentLevel } from "@chatbot/types";
import "./widget.css";

interface WidgetProps {
  websiteId: string;
  apiUrl: string;
  primaryColor: string;
  botName: string;
  welcomeMessage?: string;
}

/**
 * The Widget component is completely self-contained.
 * It has no dependency on Next.js, React Router, or any
 * framework. Just React + Zustand — that's it.
 *
 * This is intentional — the widget must work inside:
 * - WordPress (PHP rendered HTML)
 * - Webflow
 * - Shopify Liquid templates
 * - Plain HTML files
 * - Any other web technology
 */
export function Widget({
  websiteId,
  apiUrl,
  primaryColor,
  botName,
}: WidgetProps) {
  const {
    isOpen,
    sessionToken,
    messages,
    isStreaming,
    setIsOpen,
    setSessionToken,
    addMessage,
    updateLastMessage,
    finalizeLastMessage,
    setIsStreaming,
    setIntentLevel,
    setNextQuestion,
  } = useWidgetStore();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize session when widget opens
  useEffect(() => {
    if (!isOpen || sessionToken) return;

    void (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/chat/session`, {
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

        if (!res.ok) return;

        const data = (await res.json()) as {
          data: { sessionToken: string; welcomeMessage: string };
        };

        setSessionToken(data.data.sessionToken);
        addMessage({
          id: `welcome-${Date.now()}`,
          role: "assistant",
          content: data.data.welcomeMessage,
          timestamp: new Date(),
        });
      } catch {
        // Silent fail — widget shows but can't chat
      }
    })();
  }, [isOpen, sessionToken, apiUrl, websiteId, setSessionToken, addMessage]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionToken || isStreaming || !content.trim()) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      addMessage({
        id: `u-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      });

      addMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      });

      setIsStreaming(true);

      try {
        const res = await fetch(`${apiUrl}/api/chat/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Website-Id": websiteId,
          },
          body: JSON.stringify({ sessionToken, message: content.trim() }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const chunk = JSON.parse(line.slice(6)) as StreamChunk & {
                nextQuestion?: string;
              };
              if (!chunk.done && chunk.delta) updateLastMessage(chunk.delta);
              if (chunk.done) {
                finalizeLastMessage();
                if (chunk.intentLevel)
                  setIntentLevel(chunk.intentLevel as IntentLevel);
                if (chunk.nextQuestion) setNextQuestion(chunk.nextQuestion);
              }
            } catch {
              /* skip malformed */
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        finalizeLastMessage();
      } finally {
        setIsStreaming(false);
      }
    },
    [
      sessionToken,
      isStreaming,
      apiUrl,
      websiteId,
      addMessage,
      updateLastMessage,
      finalizeLastMessage,
      setIsStreaming,
      setIntentLevel,
      setNextQuestion,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = inputRef.current?.value ?? "";
      if (val.trim()) {
        void sendMessage(val);
        if (inputRef.current) {
          inputRef.current.value = "";
          inputRef.current.style.height = "auto";
        }
      }
    }
  };

  const handleSendClick = () => {
    const val = inputRef.current?.value ?? "";
    if (val.trim()) {
      void sendMessage(val);
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.style.height = "auto";
      }
    }
  };

  return (
    <div
      className="cw-fixed cw-bottom-6 cw-right-6 cw-z-[999999] cw-flex cw-flex-col cw-items-end cw-gap-3"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {isOpen && (
        <div
          className="cw-w-[380px] cw-h-[560px] cw-bg-white cw-rounded-2xl cw-flex cw-flex-col cw-overflow-hidden"
          style={{
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            border: "1px solid #e5e7eb",
          }}
        >
          {/* Header */}
          <div
            className="cw-px-4 cw-py-3 cw-flex cw-items-center cw-justify-between cw-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="cw-flex cw-items-center cw-gap-2.5">
              <div
                className="cw-w-8 cw-h-8 cw-rounded-full cw-flex cw-items-center cw-justify-center cw-text-xs cw-font-semibold cw-text-white"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                AI
              </div>
              <div>
                <p className="cw-text-sm cw-font-semibold cw-text-white cw-leading-tight">
                  {botName}
                </p>
                <p
                  className="cw-text-white cw-leading-tight"
                  style={{ fontSize: "11px", opacity: 0.8 }}
                >
                  Online · Replies instantly
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="cw-w-7 cw-h-7 cw-rounded-full cw-flex cw-items-center cw-justify-center cw-text-white"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              aria-label="Close"
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
          <div
            className="cw-flex-1 cw-overflow-y-auto cw-px-4 cw-py-4"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent:
                    msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.role === "assistant" && (
                  <div
                    className="cw-w-7 cw-h-7 cw-rounded-full cw-flex cw-items-center cw-justify-center cw-text-white cw-text-xs cw-font-medium cw-shrink-0"
                    style={{
                      backgroundColor: primaryColor,
                      marginRight: "8px",
                      alignSelf: "flex-end",
                      marginBottom: "2px",
                    }}
                  >
                    AI
                  </div>
                )}
                <div
                  className={
                    msg.role === "user"
                      ? "cw-text-white cw-text-sm cw-leading-relaxed"
                      : "cw-text-gray-800 cw-text-sm cw-leading-relaxed"
                  }
                  style={{
                    maxWidth: "80%",
                    padding: "10px 16px",
                    borderRadius:
                      msg.role === "user"
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                    backgroundColor:
                      msg.role === "user" ? primaryColor : "#f9fafb",
                    border:
                      msg.role === "assistant" ? "1px solid #e5e7eb" : "none",
                  }}
                >
                  {msg.content}
                  {msg.isStreaming && (
                    <span
                      style={{
                        display: "inline-block",
                        width: "2px",
                        height: "14px",
                        backgroundColor: "#9ca3af",
                        marginLeft: "2px",
                        animation: "pulse 1s infinite",
                      }}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  className="cw-w-7 cw-h-7 cw-rounded-full cw-flex cw-items-center cw-justify-center cw-text-white cw-text-xs cw-shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  AI
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "18px 18px 18px 4px",
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    gap: "4px",
                  }}
                >
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="cw-w-2 cw-h-2 cw-rounded-full cw-animate-bounce-dot"
                      style={{
                        backgroundColor: "#9ca3af",
                        animationDelay: `${d}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              borderTop: "1px solid #f3f4f6",
              padding: "12px",
              backgroundColor: "white",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                backgroundColor: "#f9fafb",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "8px 12px",
              }}
            >
              <textarea
                ref={inputRef}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                placeholder="Type a message..."
                disabled={isStreaming}
                rows={1}
                style={{
                  flex: 1,
                  background: "transparent",
                  resize: "none",
                  fontSize: "14px",
                  color: "#1f2937",
                  outline: "none",
                  lineHeight: "20px",
                  minHeight: "20px",
                  border: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSendClick}
                disabled={isStreaming}
                aria-label="Send"
                className="cw-w-8 cw-h-8 cw-rounded-lg cw-flex cw-items-center cw-justify-center cw-text-white cw-shrink-0"
                style={{
                  backgroundColor: primaryColor,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M1 7h12M7 1l6 6-6 6"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p
              style={{
                textAlign: "center",
                fontSize: "10px",
                color: "#9ca3af",
                marginTop: "6px",
              }}
            >
              Powered by AppViewX · Enter to send
            </p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="cw-w-14 cw-h-14 cw-rounded-full cw-flex cw-items-center cw-justify-center cw-text-white"
        style={{
          backgroundColor: primaryColor,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
          border: "none",
          cursor: "pointer",
          transition: "transform 0.15s",
        }}
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
