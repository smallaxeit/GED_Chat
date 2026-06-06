"use client";

import { useMemo, useState } from "react";
import { extractYear } from "@/lib/gedcom-parser";
import { Individual } from "@/lib/types";

function lifeSpan(ind: Individual): string {
  const b = extractYear(ind.birthDate);
  const d = extractYear(ind.deathDate);
  if (b && d) return `${b}–${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return "—";
}

export default function PeopleScreen({
  individuals,
  onBack,
  onSelect,
}: {
  individuals: Individual[];
  onBack: () => void;
  onSelect: (person: Individual) => void;
}) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const list = [...individuals].sort((a, b) => {
      const s = a.surname.localeCompare(b.surname);
      return s !== 0 ? s : a.givenName.localeCompare(b.givenName);
    });
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => i.nameFull.toLowerCase().includes(q));
  }, [individuals, query]);

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <button
          onClick={onBack}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        >
          ← Overview
        </button>
        <h1 className="font-heading text-xl text-text">
          People <span className="text-muted">· {individuals.length}</span>
        </h1>
        <span className="w-[72px]" />
      </header>

      <div className="px-6 pt-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name…"
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text caret-accent placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ul className="divide-y divide-border">
          {sorted.map((ind) => (
            <li key={ind.id}>
              <button
                onClick={() => onSelect(ind)}
                className="group flex w-full items-baseline justify-between gap-4 py-3 text-left transition-colors"
              >
                <span className="text-text group-hover:text-accent">
                  {ind.nameFull || "(unnamed)"}
                </span>
                <span className="shrink-0 text-sm text-muted">
                  {lifeSpan(ind)}
                  {ind.birthPlace ? ` · ${ind.birthPlace}` : ""}
                </span>
              </button>
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="py-10 text-center text-muted">No matches.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
