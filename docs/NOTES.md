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

### Theme: light parchment

The original palette was a dark warm-brown. It read as muddy, so the app now uses
a **light parchment** theme (cream paper, ink text, slate-blue accent). Colour
tokens live as RGB channel triplets in `:root` and are consumed via
`rgb(var(--x) / <alpha-value>)`, which is what lets Tailwind opacity modifiers
(`bg-surface/40`) work — the earlier bare-`var()` form silently produced invalid
CSS and dropped backgrounds. Re-theming is a six-line edit to the triplets.

### Summary screen is the hub

Rather than a static stats page with a "start chat" button, the summary now hosts
the **front-and-centre prompt**, and its People/Families stat tiles are clickable
entry points into searchable list screens. Suggested-question chips sit under the
prompt and fade out the moment the user starts typing, so the input owns the
space. This collapsed three screens' worth of navigation into one hub.

### Markdown rendering

The model replies in Markdown; we render it with `react-markdown` + `remark-gfm`
and hand-style it under `.message-body`. We deliberately skipped
`@tailwindcss/typography` (its `prose` defaults fight a custom theme). The chat
system prompt also explicitly asks for clean structure (lead sentence, bullets
for lists, tables for comparisons) so the formatting is actually used. The chat
route surfaces real streaming errors via `getErrorMessage` instead of the SDK's
opaque default — handy for spotting a missing `ANTHROPIC_API_KEY`.

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
- **Name casing** — `properCase()` normalizes casing/whitespace at parse time,
  fixing ALL-CAPS surnames while leaving `McDonald`/`O'Brien`/`II` intact. On the
  sample file this even merged a casing-variant surname, nudging the Kidd count
  48 → 49.
- **Malformed lines** — lines that don't match the level/tag pattern are
  skipped rather than throwing. Value capture uses `[\s\S]*` so a value that
  carries a folded `CONT` newline is kept whole instead of being truncated or
  dropped.

## Verified against real data

Tested end-to-end against `Kidd Family Tree.ged` (a real Ancestry.com 5.5.1
export):

- 119 individuals, 54 families.
- Year span 1533–2021.
- Top surnames: Kidd (49), Johnson (7), Ritchey (5), Helmley (4), Burgess (3).
- All three (broad) suggested questions generated and **verified answerable**.
- Error paths (non-GEDCOM file, no file) return clean `400`s.

---

## Suggested-question guarantees

The three starters on the summary screen are **broad, whole-tree** questions —
never tied to a cherry-picked person — and each is checked against the parsed
data (and the context the chat endpoint will build for it) before being offered:

1. **Longest-lived** — needs ≥1 person with both a birth and a death year.
2. **Largest family** — needs a couple with **2+ children**. (This is why the
   aggregate context also ships a compact families list — otherwise the question
   would have no child data to resolve against.)
3. **Origins** — needs at least one recorded birth place.

Any slot that can't be satisfied falls back to a guaranteed-safe whole-tree
question (common surnames, time span, earliest people), so there are always
exactly three and none can dead-end.

> Earlier versions named specific people (a lifespan + a BFS relationship
> between two individuals). That was dropped — naming arbitrary people in a
> starter felt random, and the relationship phrasing dragged in ugly maiden-name
> parentheticals.

---

## Candidate next steps

Concrete things worth doing next, roughly in priority order. None are blockers —
the app is fully usable without them.

1. **Prettier maiden-name display.** GEDCOM stores married names with the maiden
   name in parentheses, so lists show `Hazel E (Ritchey, Burgess) Johnson` and
   `Justina Marie (Kidd) Helmley`. Options: strip the parenthetical for display
   (→ `Hazel E Johnson`), or render it in a lighter/smaller style. Keep the raw
   value in the data so the model still sees the maiden name; only the *display*
   changes. Touches `properCase`/`parseName` or the list components.
2. **Fuzzy name matching.** `matchNames()` is exact-token today. Add a trigram or
   Levenshtein pass so nicknames, initials ("J. Kidd"), and misspellings resolve.
   Lives entirely in [`context-builder.ts`](../lib/context-builder.ts); watch for
   over-matching on common tokens.
3. **`aria-live` on the streaming reply** so screen readers announce tokens as
   they arrive (see [`DESIGN.md`](DESIGN.md#accessibility-notes)).
4. **Large-tree handling.** Aggregate questions serialize everyone; for very
   large trees, chunk or pre-aggregate server-side before it approaches the
   context limit.

---

## Known limitations / future work

- **Name matching is literal.** `matchNames()` lowercases, normalizes, and
  tokenizes, matching on full name or any name token (so single-word queries
  like "justin" or "kidd" resolve). Nicknames, initials-only references
  ("J. Kidd"), and misspellings still won't resolve — a fuzzy matcher (trigram
  or Levenshtein) would help.
- **Relationship questions need two findable names.** If only one name resolves,
  the relationship branch returns an explanatory error in the context and the
  model says it can't compute the link.
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
