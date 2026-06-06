"use client";

import { useState } from "react";
import { TreeSummary } from "@/lib/types";

export default function SummaryScreen({
  summary,
  onAsk,
  onOpenPeople,
  onOpenFamilies,
}: {
  summary: TreeSummary;
  onAsk: (question: string) => void;
  onOpenPeople: () => void;
  onOpenFamilies: () => void;
}) {
  const [input, setInput] = useState("");
  const typing = input.trim().length > 0;

  const span =
    summary.earliestYear && summary.latestYear
      ? `${summary.earliestYear}–${summary.latestYear}`
      : "—";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (q) onAsk(q);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-center font-heading text-3xl text-text sm:text-4xl">
        Ask your family tree
      </h1>

      {/* Clickable stat tiles. People & Families navigate; Years is static. */}
      <div className="mx-auto mt-8 grid w-full grid-cols-3 gap-3">
        <button
          onClick={onOpenPeople}
          className="group rounded-lg border border-border bg-surface px-4 py-5 text-left transition-colors hover:border-accent hover:bg-surface"
        >
          <div className="font-heading text-2xl text-accent">
            {summary.individualCount.toLocaleString()}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-muted group-hover:text-text">
            People →
          </div>
        </button>

        <button
          onClick={onOpenFamilies}
          className="group rounded-lg border border-border bg-surface px-4 py-5 text-left transition-colors hover:border-accent hover:bg-surface"
        >
          <div className="font-heading text-2xl text-accent">
            {summary.familyCount.toLocaleString()}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-muted group-hover:text-text">
            Families →
          </div>
        </button>

        <div className="rounded-lg border border-border bg-surface px-4 py-5">
          <div className="font-heading text-2xl text-accent">{span}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-muted">
            Years
          </div>
        </div>
      </div>

      {/* Front-and-center prompt. */}
      <form onSubmit={submit} className="mt-8">
        <div className="flex items-center gap-3">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything — a person, a date, a place, a relationship…"
            className="flex-1 rounded-xl border border-border bg-surface px-5 py-4 text-base text-text caret-accent placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!typing}
            className="rounded-xl bg-accent px-6 py-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </form>

      {/* Suggestions live below the prompt and clear out once typing begins. */}
      <div
        className={`mt-5 transition-opacity duration-200 ${
          typing ? "pointer-events-none h-0 overflow-hidden opacity-0" : "opacity-100"
        }`}
      >
        <p className="text-xs uppercase tracking-wide text-muted">Try asking</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => onAsk(q)}
              className="rounded-full border border-border bg-surface px-4 py-2 text-left text-sm text-text transition-colors hover:border-accent hover:bg-surface hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
