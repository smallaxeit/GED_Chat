# Notes — decisions, trade-offs, edge cases

A running log of the non-obvious calls made while building this, what they cost,
and where the sharp edges are.

---

## Decisions & trade-offs

### Why upload returns `treeData` too

The brief says `/api/upload` returns `TreeSummary`. We return
`{ summary, treeData }`. The client needs the *parsed* tree in React state to
build chat context (`buildContext` runs in the browser). The alternatives were:

1. **Parse twice** — once on the server for the summary, once on the client for
   `treeData`. Wasteful, and the two parses could drift.
2. **Return both from one parse** — chosen. The server still stores nothing; it
   parses, responds, and forgets. Statelessness is preserved.

If a stricter reading is required (upload returns *only* the summary), move
`parseGedcom` to the client and have upload return just the summary. The
parser is isomorphic, so this is a small change.

### Model choice

`claude-sonnet-4-6`. The task is grounded Q&A over a compact structured payload —
Sonnet is fast and more than capable, and keeps streaming snappy. Swap the model
id in [`app/api/chat/route.ts`](../app/api/chat/route.ts) if you want Opus-level
reasoning for very tangled relationship questions.

### Context as slices, not the whole tree

Sending the entire tree every turn would balloon the context window and slow
every answer on large files. Instead each question type sends only what it needs
(see [`ARCHITECTURE.md`](ARCHITECTURE.md#the-five-context-branches)). Aggregate
questions are the exception — they need everyone — so those records are
compacted (id, name, dates, places; nulls stripped).

### Next.js version bump

Spec pinned `14.2.5`; that release has a security advisory. Using `^14.2.35`.

---

## Parser edge cases handled

- **CONT vs CONC** — `CONT` joins with a newline, `CONC` joins with nothing.
  Reassembled *before* level-walking so multi-line values (addresses, notes)
  survive intact.
- **Duplicate events** — some individuals carry two `BIRT` blocks (seen in the
  sample Ancestry export). The **first** of each event type wins.
- **Date soup** — the sample file alone contains `08 25 1979`, `abt 1980`,
  `1 Nov 1971`, `06 JUN 1809`, `01/14/2017`, `04-20-2006`, `1533`, and
  `1935-1993`. `extractYear()` doesn't try to fully parse these; it grabs the
  first plausible 4-digit year (1000–2100) for span/temporal math, and the raw
  string is preserved for display and for the model to read verbatim.
- **ID normalization** — `@I48114428611@` → `I48114428611`. Long Ancestry IDs
  work the same as short `@I1@` ones.
- **Names** — `Given /SURNAME/ suffix`. No slashes → the whole string is the
  given name, surname empty. Married-name forms like
  `Justina Marie (Kidd) /Helmley/` parse cleanly (surname `Helmley`).
- **Malformed lines** — lines that don't match the level/tag pattern are
  skipped rather than throwing.

## Verified against real data

Tested end-to-end against `Kidd Family Tree.ged` (a real Ancestry.com 5.5.1
export):

- 119 individuals, 54 families.
- Year span 1533–2021.
- Top surnames: Kidd (48), Johnson (7), Ritchey (5), Helmley (4), Burgess (3).
- All three suggested questions generated and **verified answerable**, including
  a live BFS relationship path between two cross-surname individuals.
- Error paths (non-GEDCOM file, no file) return clean `400`s.

---

## Suggested-question guarantees

The three starters on the summary screen are not guesses — each is checked
against the parsed tree before being offered:

1. **Lifespan** — a person with *both* a resolvable birth and death year.
2. **Relationship** — two people with an actual BFS path of length ≥ 3
   (prefers cross-surname pairs for a more interesting answer).
3. **Aggregate** — a birth place that appears **3+ times**.

Any slot that can't be satisfied falls back to a guaranteed-safe generic
question, so there are always exactly three and none can dead-end.

---

## Known limitations / future work

- **Name matching is literal.** `matchNames()` lowercases and normalizes, then
  matches on full name, given name, or surname. Nicknames, initials-only
  references ("J. Kidd"), and fuzzy/misspelled names won't resolve. A fuzzy
  matcher (e.g. trigram or Levenshtein) would help.
- **Relationship questions need two findable names.** If only one name resolves,
  the relationship branch returns an explanatory error in the context and the
  model says it can't compute the link.
- **No markdown rendering** of assistant replies — shown as pre-wrapped plain
  text. A markdown renderer would improve lists/tables.
- **No persistence across refresh** — by design. Reload = re-upload. This is the
  privacy/statelessness trade-off, not a bug.
- **Temporal overlap is approximate** — when only a birth *or* death year is
  known, the lifespan is estimated with an ±80-year window to decide overlap.
- **GEDCOM dialects** — tuned to 5.5.1 / Ancestry exports. Other exporters
  (custom tags, `_` extensions) parse for the standard tags and ignore the rest.
- **Large trees** — aggregate questions serialize everyone (compacted). For very
  large trees this could approach context limits; chunking or server-side
  pre-aggregation would be the next step.

---

## Operational reminders

- Chat needs `ANTHROPIC_API_KEY` in `.env.local`. Upload and summary work
  without it — handy for testing the parser in isolation.
- `npm run build` runs a full type-check; treat a green build as the gate.
- The API key is server-only; never import it or reference `process.env` from a
  `'use client'` component.
