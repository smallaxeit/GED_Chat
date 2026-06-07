import { extractYear } from "./gedcom-parser";
import { findPath } from "./relationship";
import { ContextPayload, Individual, TreeData } from "./types";

export type QuestionType =
  | "relationship"
  | "biographical"
  | "aggregate"
  | "temporal"
  | "fallback";

const RELATIONSHIP_KW = [
  "related",
  "relationship",
  "cousin",
  "uncle",
  "aunt",
  "ancestor",
  "descendant",
  "nephew",
  "niece",
  "grandparent",
  "grandchild",
];
const BIOGRAPHICAL_KW = [
  "born",
  "died",
  "death",
  "birth",
  "married",
  "lived",
  "when",
  "where",
  "who is",
  "who was",
  "tell me about",
  "occupation",
];
const AGGREGATE_KW = [
  "most",
  "longest",
  "oldest",
  "youngest",
  "how many",
  "all ",
  "list",
  "count",
  "average",
  "common",
  "earliest",
  "latest",
];
const TEMPORAL_KW = [
  "alive in",
  "born in",
  "died in",
  "during",
  "century",
  "generation",
  "before",
  "after",
  "between",
];

function hasAny(haystack: string, words: string[]): boolean {
  return words.some((w) => haystack.includes(w));
}

/** Classify a question into one of five context-building branches. */
export function classifyQuestion(question: string): QuestionType {
  const q = question.toLowerCase();

  // Relationship is checked first; "how is X related to Y" is the strongest signal.
  if (hasAny(q, RELATIONSHIP_KW)) return "relationship";

  // Temporal before aggregate/biographical when an explicit year/era is present.
  if (hasAny(q, TEMPORAL_KW) && /\b\d{3,4}\b|century|generation/.test(q)) {
    return "temporal";
  }

  if (hasAny(q, AGGREGATE_KW)) return "aggregate";
  if (hasAny(q, BIOGRAPHICAL_KW)) return "biographical";

  return "fallback";
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,?!;:'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find individuals named in a question. Matches on the full name, the given
 * name alone, or the surname alone. Returns matches ordered by specificity
 * (full-name matches first), de-duplicated.
 */
export function matchNames(
  question: string,
  individuals: Individual[]
): Individual[] {
  const q = normalize(question);
  const qTokens = new Set(q.split(" ").filter((t) => t.length > 1));

  const full: Individual[] = [];
  const partial: Individual[] = [];

  for (const ind of individuals) {
    const fullName = normalize(ind.nameFull);

    if (fullName && q.includes(fullName)) {
      full.push(ind);
      continue;
    }

    // Tokenize so a single-word query ("justin", "kidd") still matches a
    // multi-word given ("Justin M") or compound surname ("(Kreigbaum) Ritchey").
    const nameTokens = [
      ...normalize(ind.givenName).split(" "),
      ...normalize(ind.surname).split(" "),
    ].filter((t) => t.length > 1);

    if (nameTokens.some((t) => qTokens.has(t))) {
      partial.push(ind);
    }
  }

  const seen = new Set<string>();
  const ordered: Individual[] = [];
  for (const ind of [...full, ...partial]) {
    if (seen.has(ind.id)) continue;
    seen.add(ind.id);
    ordered.push(ind);
  }
  return ordered;
}

function lifeYears(ind: Individual): { birth: number | null; death: number | null } {
  return { birth: extractYear(ind.birthDate), death: extractYear(ind.deathDate) };
}

/** Count how many meaningful (non-null/non-empty) fields an individual has. */
function infoScore(ind: Individual): number {
  let score = 0;
  const fields: (string | null)[] = [
    ind.birthDate,
    ind.birthPlace,
    ind.deathDate,
    ind.deathPlace,
    ind.burialDate,
    ind.burialPlace,
    ind.occupation,
  ];
  for (const f of fields) if (f) score += 1;
  if (ind.surname) score += 1;
  score += ind.familiesAsSpouse.length + ind.familiesAsChild.length;
  return score;
}

/** Compact view of an individual for aggregate/list contexts (strips nulls). */
function compactIndividual(ind: Individual): Record<string, unknown> {
  const out: Record<string, unknown> = { id: ind.id, name: ind.nameFull };
  if (ind.birthDate) out.birthDate = ind.birthDate;
  if (ind.birthPlace) out.birthPlace = ind.birthPlace;
  if (ind.deathDate) out.deathDate = ind.deathDate;
  if (ind.deathPlace) out.deathPlace = ind.deathPlace;
  if (ind.occupation) out.occupation = ind.occupation;
  return out;
}

/** Compact view of a family for aggregate contexts (couple, marriage, children). */
function compactFamily(
  fam: { husbandId: string | null; wifeId: string | null; childIds: string[]; marriageDate: string | null },
  treeData: TreeData
): Record<string, unknown> {
  const nameOf = (id: string | null) =>
    id && treeData.individuals[id] ? treeData.individuals[id].nameFull : null;

  const out: Record<string, unknown> = { childCount: fam.childIds.length };
  const husband = nameOf(fam.husbandId);
  const wife = nameOf(fam.wifeId);
  if (husband) out.husband = husband;
  if (wife) out.wife = wife;
  if (fam.marriageDate) out.marriageDate = fam.marriageDate;
  const children = fam.childIds
    .map((id) => nameOf(id))
    .filter((n): n is string => !!n);
  if (children.length > 0) out.children = children;
  return out;
}

function familyOf(id: string, treeData: TreeData) {
  return treeData.families[id] ?? null;
}

/** Resolve parents, spouses, and children of an individual into full records. */
function relatives(ind: Individual, treeData: TreeData) {
  const parents: Individual[] = [];
  const spouses: Individual[] = [];
  const children: Individual[] = [];

  for (const famId of ind.familiesAsChild) {
    const fam = familyOf(famId, treeData);
    if (!fam) continue;
    for (const pid of [fam.husbandId, fam.wifeId]) {
      if (pid && treeData.individuals[pid]) parents.push(treeData.individuals[pid]);
    }
  }

  for (const famId of ind.familiesAsSpouse) {
    const fam = familyOf(famId, treeData);
    if (!fam) continue;
    const spouseId = fam.husbandId === ind.id ? fam.wifeId : fam.husbandId;
    if (spouseId && treeData.individuals[spouseId]) {
      spouses.push(treeData.individuals[spouseId]);
    }
    for (const cid of fam.childIds) {
      if (treeData.individuals[cid]) children.push(treeData.individuals[cid]);
    }
  }

  return { parents, spouses, children };
}

/** Extract 3- or 4-digit years referenced in a question. */
function extractYears(question: string): number[] {
  const matches = question.match(/\b\d{3,4}\b/g) ?? [];
  return matches
    .map((m) => parseInt(m, 10))
    .filter((y) => y >= 1000 && y <= 2100);
}

/**
 * Build a compact, question-specific context payload for the chat model.
 * The payload always carries the question type so the model knows the shape.
 */
export function buildContext(
  question: string,
  treeData: TreeData
): ContextPayload {
  const type = classifyQuestion(question);
  const all = Object.values(treeData.individuals);

  if (type === "relationship") {
    const matched = matchNames(question, all);
    const [a, b] = matched;

    if (!a || !b) {
      return {
        questionType: "relationship",
        error:
          "Could not identify two distinct individuals in the question to compute a relationship.",
        matchedNames: matched.slice(0, 5).map((i) => ({ id: i.id, name: i.nameFull })),
      };
    }

    const path = findPath(a.id, b.id, treeData);

    if (!path) {
      return {
        questionType: "relationship",
        from: a,
        to: b,
        relationshipPath: null,
      };
    }

    const pathIndividuals = path.map((step) => ({
      ...treeData.individuals[step.individualId],
      relationToNext: step.relationToNext,
    }));

    return {
      questionType: "relationship",
      from: a,
      to: b,
      relationshipPath: pathIndividuals,
    };
  }

  if (type === "biographical") {
    const matched = matchNames(question, all);
    if (matched.length === 0) {
      // No name resolved — fall back to information-rich individuals.
      return buildFallback(question, treeData);
    }

    const subjects = matched.slice(0, 5);
    const records = subjects.map((subj) => {
      const { parents, spouses, children } = relatives(subj, treeData);
      return { individual: subj, parents, spouses, children };
    });

    // Cap total individuals at 50.
    const capped = capIndividualBundles(records, 50);

    return {
      questionType: "biographical",
      subjects: capped,
    };
  }

  if (type === "aggregate") {
    return {
      questionType: "aggregate",
      individualCount: all.length,
      familyCount: Object.keys(treeData.families).length,
      individuals: all.map(compactIndividual),
      families: Object.values(treeData.families).map((f) =>
        compactFamily(f, treeData)
      ),
    };
  }

  if (type === "temporal") {
    const years = extractYears(question);
    const target = years.length > 0 ? years : null;

    const overlaps = (ind: Individual): boolean => {
      if (!target) return false;
      const { birth, death } = lifeYears(ind);
      if (birth === null && death === null) return false;
      const lo = birth ?? (death !== null ? death - 80 : null);
      const hi = death ?? (birth !== null ? birth + 80 : null);
      if (lo === null || hi === null) return false;
      return target.some((y) => y >= lo && y <= hi);
    };

    let filtered = target ? all.filter(overlaps) : [];
    if (filtered.length === 0) {
      // No year, or nobody overlaps — fall back to the richest individuals
      // so the model still has material to reason about a century/generation.
      filtered = [...all].sort((x, y) => infoScore(y) - infoScore(x));
    }

    return {
      questionType: "temporal",
      years: target,
      individuals: filtered.slice(0, 50).map(compactIndividual),
    };
  }

  return buildFallback(question, treeData);
}

function buildFallback(question: string, treeData: TreeData): ContextPayload {
  const all = Object.values(treeData.individuals);
  const matched = matchNames(question, all);

  if (matched.length > 0) {
    const subjects = matched.slice(0, 50);
    const records = subjects.map((subj) => {
      const { parents, spouses, children } = relatives(subj, treeData);
      return { individual: subj, parents, spouses, children };
    });
    return {
      questionType: "fallback",
      subjects: capIndividualBundles(records, 50),
    };
  }

  const richest = [...all]
    .sort((a, b) => infoScore(b) - infoScore(a))
    .slice(0, 20);

  return {
    questionType: "fallback",
    note: "No individuals were named; showing the most information-rich people in the tree.",
    individuals: richest,
  };
}

type Bundle = {
  individual: Individual;
  parents: Individual[];
  spouses: Individual[];
  children: Individual[];
};

/** Trim relative bundles so the total distinct individual count stays under cap. */
function capIndividualBundles(bundles: Bundle[], cap: number): Bundle[] {
  const seen = new Set<string>();
  const result: Bundle[] = [];

  const take = (ind: Individual): boolean => {
    if (seen.size >= cap) return false;
    seen.add(ind.id);
    return true;
  };

  for (const bundle of bundles) {
    if (!take(bundle.individual)) break;
    const parents = bundle.parents.filter(take);
    const spouses = bundle.spouses.filter(take);
    const children = bundle.children.filter(take);
    result.push({ individual: bundle.individual, parents, spouses, children });
    if (seen.size >= cap) break;
  }

  return result;
}
