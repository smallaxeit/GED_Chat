import { NextRequest, NextResponse } from "next/server";
import { extractYear, parseGedcom } from "@/lib/gedcom-parser";
import { Individual, TreeData, TreeSummary } from "@/lib/types";

export const runtime = "nodejs";

function buildSummary(tree: TreeData): TreeSummary {
  const individuals = Object.values(tree.individuals);

  // Earliest / latest years across all birth and death dates.
  let earliestYear: number | null = null;
  let latestYear: number | null = null;
  for (const ind of individuals) {
    for (const d of [ind.birthDate, ind.deathDate, ind.burialDate]) {
      const y = extractYear(d);
      if (y === null) continue;
      if (earliestYear === null || y < earliestYear) earliestYear = y;
      if (latestYear === null || y > latestYear) latestYear = y;
    }
  }

  // Top 5 surnames.
  const surnameCounts = new Map<string, number>();
  for (const ind of individuals) {
    const s = ind.surname.trim();
    if (!s) continue;
    surnameCounts.set(s, (surnameCounts.get(s) ?? 0) + 1);
  }
  const topSurnames = [...surnameCounts.entries()]
    .map(([surname, count]) => ({ surname, count }))
    .sort((a, b) => b.count - a.count || a.surname.localeCompare(b.surname))
    .slice(0, 5);

  const suggestedQuestions = buildSuggestedQuestions(tree, individuals);

  return {
    individualCount: individuals.length,
    familyCount: Object.keys(tree.families).length,
    earliestYear,
    latestYear,
    topSurnames,
    suggestedQuestions,
  };
}

/**
 * Generate exactly three broad, whole-tree suggested questions — never tied to
 * a specific named person. Each is verified to be answerable from the parsed
 * data and the context the chat endpoint will assemble for it:
 *  1. longest-lived — needs at least one person with both birth & death years
 *  2. largest family — needs a couple with 2+ children (families travel in the
 *     aggregate context)
 *  3. origins — needs recorded birth places
 * Any slot that cannot be satisfied falls back to a guaranteed-safe question.
 */
function buildSuggestedQuestions(
  tree: TreeData,
  individuals: Individual[]
): string[] {
  const questions: string[] = [];

  // 1. Longest-lived.
  const hasLifespan = individuals.some(
    (i) => extractYear(i.birthDate) !== null && extractYear(i.deathDate) !== null
  );
  if (hasLifespan) {
    questions.push("Who lived the longest in this family?");
  }

  // 2. Largest family (the aggregate context carries family child counts).
  const maxChildren = Object.values(tree.families).reduce(
    (max, f) => Math.max(max, f.childIds.length),
    0
  );
  if (maxChildren >= 2) {
    questions.push("Which couple had the most children?");
  }

  // 3. Where the family came from.
  const hasBirthPlaces = individuals.some((i) => !!i.birthPlace);
  if (hasBirthPlaces) {
    questions.push("Where did most of the family come from?");
  }

  // Fill any remaining slots with guaranteed-safe, whole-tree questions.
  const fallbacks = [
    "Which surnames are most common in this tree?",
    "What time period does this family tree cover?",
    "Who are the earliest people recorded in the tree?",
  ];
  for (const f of fallbacks) {
    if (questions.length >= 3) break;
    if (!questions.includes(f)) questions.push(f);
  }

  return questions.slice(0, 3);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No file was uploaded." },
        { status: 400 }
      );
    }

    const text = await (file as File).text();
    if (!text.trim()) {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 }
      );
    }

    const tree = parseGedcom(text);

    if (Object.keys(tree.individuals).length === 0) {
      return NextResponse.json(
        {
          error:
            "No individuals were found. This does not appear to be a valid GEDCOM file.",
        },
        { status: 400 }
      );
    }

    const summary = buildSummary(tree);
    return NextResponse.json({ summary, treeData: tree });
  } catch (err) {
    console.error("Upload parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse the GEDCOM file." },
      { status: 400 }
    );
  }
}
