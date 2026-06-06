"use client";

import { useMemo } from "react";
import { extractYear } from "@/lib/gedcom-parser";
import { Family, TreeData } from "@/lib/types";

export default function FamiliesScreen({
  treeData,
  onBack,
  onSelect,
}: {
  treeData: TreeData;
  onBack: () => void;
  onSelect: (family: Family) => void;
}) {
  const families = useMemo(() => {
    const nameOf = (id: string | null) =>
      id && treeData.individuals[id] ? treeData.individuals[id].nameFull : null;

    return Object.values(treeData.families)
      .map((fam) => ({
        fam,
        husband: nameOf(fam.husbandId),
        wife: nameOf(fam.wifeId),
        year: extractYear(fam.marriageDate),
        childCount: fam.childIds.length,
      }))
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  }, [treeData]);

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
          Families{" "}
          <span className="text-muted">· {families.length}</span>
        </h1>
        <span className="w-[72px]" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ul className="divide-y divide-border">
          {families.map(({ fam, husband, wife, year, childCount }) => {
            const couple =
              [husband, wife].filter(Boolean).join("  &  ") || "(unknown couple)";
            return (
              <li key={fam.id}>
                <button
                  onClick={() => onSelect(fam)}
                  className="group flex w-full items-baseline justify-between gap-4 py-3 text-left transition-colors"
                >
                  <span className="text-text group-hover:text-accent">
                    {couple}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {year ? `m. ${year}` : ""}
                    {year && childCount ? " · " : ""}
                    {childCount
                      ? `${childCount} ${childCount === 1 ? "child" : "children"}`
                      : ""}
                  </span>
                </button>
              </li>
            );
          })}
          {families.length === 0 && (
            <li className="py-10 text-center text-muted">
              No families in this tree.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
