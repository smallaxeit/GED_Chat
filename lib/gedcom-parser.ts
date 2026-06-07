import { Family, Individual, TreeData } from "./types";

/** Strip surrounding @ signs from a cross-reference id: '@I1@' -> 'I1'. */
function normalizeId(raw: string): string {
  return raw.replace(/@/g, "").trim();
}

/**
 * Fold CONT/CONC continuation lines into their parent line's value.
 * - CONT appends a newline + the text.
 * - CONC appends the text directly.
 * The continuation lines are removed from the returned array.
 */
export function reassembleContinuations(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+(\S+)(?:\s(.*))?$/);
    const tag = m?.[2];
    const value = m?.[3] ?? "";

    if (tag === "CONT" || tag === "CONC") {
      if (out.length === 0) continue; // nothing to attach to
      const sep = tag === "CONT" ? "\n" : "";
      out[out.length - 1] = out[out.length - 1] + sep + value;
      continue;
    }
    out.push(line);
  }
  return out;
}

const ROMAN_SUFFIXES = new Set([
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
]);

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Title-case a single alphabetic token, preserving names that are clearly
 *  intentional (already mixed-case like McDonald, DeWitt, O'Brien) and
 *  generational roman numerals (II, III, IV…). */
function capitalizeToken(token: string): string {
  if (token.length === 1) return token.toUpperCase();

  const upper = token.toUpperCase();
  if (token === upper && ROMAN_SUFFIXES.has(upper)) return upper;

  const isAllUpper = token === upper;
  const isAllLower = token === token.toLowerCase();
  // Leave intentional mixed case alone (McDonald, DeWitt, LaRue…).
  if (!isAllUpper && !isAllLower) return token;

  const lower = token.toLowerCase();

  // O'Brien, D'Angelo — capitalize each side of the apostrophe.
  if (/['’]/.test(lower)) {
    return lower
      .split(/(['’])/)
      .map((part) => (/['’]/.test(part) ? part : cap(part)))
      .join("");
  }

  // Scottish/Irish "Mc" prefix: McDonald.
  if (/^mc[a-z]/.test(lower)) return "Mc" + cap(lower.slice(2));

  return cap(lower);
}

/** Normalize a name's whitespace and capitalization for display. */
export function properCase(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  return cleaned.replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g, capitalizeToken);
}

/**
 * Parse a GEDCOM name value of the form `Given /SURNAME/ suffix`.
 * - givenName: everything before the first slash (trimmed)
 * - surname: text between the first and second slash
 * - no slashes: whole string is the given name, surname is ''
 */
export function parseName(raw: string): { givenName: string; surname: string } {
  const first = raw.indexOf("/");
  if (first === -1) {
    return { givenName: raw.trim(), surname: "" };
  }
  const second = raw.indexOf("/", first + 1);
  const givenName = raw.slice(0, first).trim();
  const surname =
    second === -1 ? raw.slice(first + 1).trim() : raw.slice(first + 1, second).trim();
  return { givenName, surname };
}

interface Node {
  level: number;
  tag: string;
  value: string;
  xref: string | null; // present on top-level records: '0 @I1@ INDI'
  children: Node[];
}

/** Level-walk flat GEDCOM lines into a tree of top-level records. */
function buildRecordTree(lines: string[]): Node[] {
  const records: Node[] = [];
  const stack: Node[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "") continue;

    // Value uses [\s\S]* (not .*) so values carrying a folded CONT newline are
    // captured whole rather than truncating — or dropping — the line.
    const m = line.match(/^(\d+)\s+(@[^@]+@)?\s*(\S+)?(?:\s([\s\S]*))?$/);
    if (!m) continue;

    const level = parseInt(m[1], 10);
    const maybeXref = m[2] ?? null;
    let tag: string;
    let value: string;
    let xref: string | null = null;

    if (maybeXref) {
      // '0 @I1@ INDI' -> xref is the pointer, tag is the record type
      xref = maybeXref;
      tag = m[3] ?? "";
      value = m[4] ?? "";
    } else {
      tag = m[3] ?? "";
      value = m[4] ?? "";
    }

    const node: Node = { level, tag, value, xref, children: [] };

    // Pop the stack back to the parent level.
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      records.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return records;
}

function child(node: Node, tag: string): Node | undefined {
  return node.children.find((c) => c.tag === tag);
}

function childValue(node: Node, tag: string): string | null {
  const c = child(node, tag);
  const v = c?.value.trim();
  return v ? v : null;
}

/** Read DATE and PLAC from an event sub-record (e.g. BIRT, DEAT). */
function readEvent(node: Node | undefined): { date: string | null; place: string | null } {
  if (!node) return { date: null, place: null };
  return { date: childValue(node, "DATE"), place: childValue(node, "PLAC") };
}

function parseIndividual(rec: Node): Individual {
  const id = normalizeId(rec.xref ?? "");

  const nameNode = child(rec, "NAME");
  const nameRaw = nameNode?.value ?? "";
  const parsed = parseName(nameRaw);
  const givenName = properCase(parsed.givenName);
  const surname = properCase(parsed.surname);
  const nameFull = [givenName, surname].filter(Boolean).join(" ").trim();

  const sexRaw = childValue(rec, "SEX");
  const sex: Individual["sex"] = sexRaw === "M" || sexRaw === "F" ? sexRaw : "U";

  // Take the FIRST event of each type (records may contain duplicates).
  const birth = readEvent(child(rec, "BIRT"));
  const death = readEvent(child(rec, "DEAT"));
  const burial = readEvent(child(rec, "BURI"));

  const familiesAsSpouse = rec.children
    .filter((c) => c.tag === "FAMS" && c.value.trim())
    .map((c) => normalizeId(c.value));
  const familiesAsChild = rec.children
    .filter((c) => c.tag === "FAMC" && c.value.trim())
    .map((c) => normalizeId(c.value));

  return {
    id,
    givenName,
    surname,
    nameFull,
    sex,
    birthDate: birth.date,
    birthPlace: birth.place,
    deathDate: death.date,
    deathPlace: death.place,
    burialDate: burial.date,
    burialPlace: burial.place,
    occupation: childValue(rec, "OCCU"),
    familiesAsSpouse,
    familiesAsChild,
  };
}

function parseFamily(rec: Node): Family {
  const id = normalizeId(rec.xref ?? "");
  const husb = childValue(rec, "HUSB");
  const wife = childValue(rec, "WIFE");
  const marriage = readEvent(child(rec, "MARR"));

  const childIds = rec.children
    .filter((c) => c.tag === "CHIL" && c.value.trim())
    .map((c) => normalizeId(c.value));

  return {
    id,
    husbandId: husb ? normalizeId(husb) : null,
    wifeId: wife ? normalizeId(wife) : null,
    childIds,
    marriageDate: marriage.date,
    marriagePlace: marriage.place,
  };
}

/** Parse raw GEDCOM text into normalized TreeData. */
export function parseGedcom(text: string): TreeData {
  const lines = reassembleContinuations(text.split(/\r?\n/));
  const records = buildRecordTree(lines);

  const individuals: Record<string, Individual> = {};
  const families: Record<string, Family> = {};

  for (const rec of records) {
    if (rec.tag === "INDI" && rec.xref) {
      const ind = parseIndividual(rec);
      if (ind.id) individuals[ind.id] = ind;
    } else if (rec.tag === "FAM" && rec.xref) {
      const fam = parseFamily(rec);
      if (fam.id) families[fam.id] = fam;
    }
  }

  return { individuals, families };
}

/** Extract a plausible 4-digit year (1000–2100) from a free-form date string. */
export function extractYear(date: string | null): number | null {
  if (!date) return null;
  const matches = date.match(/\d{4}/g);
  if (!matches) return null;
  for (const m of matches) {
    const year = parseInt(m, 10);
    if (year >= 1000 && year <= 2100) return year;
  }
  return null;
}
