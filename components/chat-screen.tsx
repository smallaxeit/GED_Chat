"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildContext } from "@/lib/context-builder";
import { TreeData } from "@/lib/types";

export default function ChatScreen({
  treeData,
  initialQuestion,
  onBack,
  onReset,
}: {
  treeData: TreeData;
  initialQuestion: string | null;
  onBack: () => void;
  onReset: () => void;
}) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
  } = useChat({
    api: "/api/chat",
    experimental_prepareRequestBody({ messages }) {
      const lastUserMessage = messages.filter((m) => m.role === "user").at(-1);
      const context = lastUserMessage
        ? buildContext(lastUserMessage.content, treeData)
        : {};
      return { messages, context };
    },
  });

  // Fire the initial (suggested) question exactly once, even under StrictMode.
  const firedInitial = useRef(false);
  useEffect(() => {
    if (initialQuestion && !firedInitial.current) {
      firedInitial.current = true;
      append({ role: "user", content: initialQuestion });
    }
  }, [initialQuestion, append]);

  // Keep the latest message in view as it streams.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <button
          onClick={onBack}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        >
          ← Overview
        </button>
        <h1 className="font-heading text-xl text-text">Family Tree Q&amp;A</h1>
        <button
          onClick={onReset}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        >
          New file
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-8">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-muted">
            Ask anything about your family tree.
          </p>
        )}

        {messages.map((m, idx) => {
          const isLast = idx === messages.length - 1;
          const showCursor =
            isLast && m.role === "assistant" && isLoading;
          return (
            <div
              key={m.id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-surface px-4 py-2.5 text-text">
                  {m.content}
                </div>
              ) : (
                <div className="message-body max-w-[85%] border-l-2 border-accent/40 pl-4 text-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                  {showCursor && <span className="streaming-cursor" />}
                </div>
              )}
            </div>
          );
        })}

        {/* Cursor while the assistant message has not yet started streaming. */}
        {isLoading && messages.at(-1)?.role === "user" && (
          <div className="flex justify-start">
            <div className="border-l-2 border-accent/40 pl-4">
              <span className="streaming-cursor" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-6 py-4"
      >
        <div className="flex items-end gap-3">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about a person, date, place, or relationship…"
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-text caret-accent placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
