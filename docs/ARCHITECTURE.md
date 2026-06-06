# Architecture

## Guiding principle: a stateless server

The server stores nothing. No database, no session store, no in-memory cache of
parsed trees. This is the single decision that shapes everything else.

- **Upload** parses the file, returns the result, and forgets it.
- **The parsed `TreeData` lives in React state** in the browser
  ([`app/page.tsx`](../app/page.tsx)).
- **Every chat request is self-contained** — it ships a freshly-built context
  payload alongside the messages. The server never looks anything up.

Why: it makes the app trivially horizontally scalable, removes a whole class of
session bugs, and keeps the user's genealogical data out of any server-side
persistence. The cost is that the context for each question is rebuilt on the
client and sent over the wire — which is cheap, because we send a *slice*, not
the whole tree (see [The five context branches](#the-five-context-branches)).

---

## Data flow

```
┌────────────┐   multipart .ged    ┌──────────────────┐
│  Browser   │ ──────────────────▶ │  /api/upload     │
│            │                     │  parseGedcom()   │
│            │ ◀────────────────── │  buildSummary()  │  (returns, stores nothing)
│            │  TreeSummary +      └──────────────────┘
│            │  TreeData
│  React     │
│  state ────┼─ treeData ─┐
│            │            │
│  question  │            │  buildContext(question, treeData)
│     │      │            ▼
│     ▼      │   ┌──────────────────────┐
│  useChat   │   │ classifyQuestion()   │
│  experimental_prepareRequestBody      │
│     │      │   └──────────────────────┘
│     ▼      │            │ { messages, context }
└────────────┘            ▼
                 ┌──────────────────┐
                 │  /api/chat       │
                 │  streamText()    │ ──▶ Claude ──▶ streamed tokens
                 └──────────────────┘
```

### 1. Upload ([`app/api/upload/route.ts`](../app/api/upload/route.ts))

Receives the `.ged` as `multipart/form-data`.

1. `parseGedcom(text)` → `TreeData`.
2. `buildSummary(tree)` → counts, year span, top-5 surnames, and **three
   data-verified suggested questions**.
3. Returns `{ summary, treeData }`.

Returns `400 { error }` on empty input, a file with zero individuals, or any
parse failure.

> **Spec note.** The brief says upload returns `TreeSummary`. We also return
> `treeData` in the same response because the client needs the parsed tree in
> state to build chat context — returning it here avoids parsing the file twice
> (once on the server for the summary, once on the client). The server still
> persists nothing. See [`NOTES.md`](NOTES.md#why-upload-returns-treedata-too).

### 2. Context building ([`lib/context-builder.ts`](../lib/context-builder.ts))

Runs **on the client**, inside `experimental_prepareRequestBody`. The last user
message is classified and turned into a compact, question-shaped payload.

### 3. Chat ([`app/api/chat/route.ts`](../app/api/chat/route.ts))

Receives `{ messages, context }`. The context is `JSON.stringify`-ed into the
system prompt, which instructs the model to answer **only** from the provided
data and never to invent people or relationships. `streamText` returns a data
stream consumed by `useChat`.

---

## The five context branches

`classifyQuestion()` keyword-matches the question into one branch. Each branch
returns a differently shaped, deliberately small payload so the model gets
exactly what it needs and nothing more.

| Branch          | Triggers (keywords)                                            | Payload                                                                 | Cap  |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | ---- |
| **Relationship**| related, cousin, uncle, aunt, ancestor, descendant…           | Both full records + every person on the BFS path + edge labels         | none |
| **Biographical**| born, died, married, when, where, who is, tell me about…      | Subject's full record + parents + spouses + children                   | 50   |
| **Aggregate**   | most, longest, oldest, how many, list, count, average…       | Compact list of everyone (id, name, dates, places; nulls stripped)     | none |
| **Temporal**    | alive in, born in <year>, during, century, generation…       | People whose lifespan overlaps the referenced year(s)                  | 50   |
| **Fallback**    | anything else                                                  | Named people + immediate family, **or** the 20 richest records         | 50   |

Classification order matters: relationship is checked first (strongest signal),
then temporal (only when an explicit year/era is present), then aggregate,
then biographical, else fallback.

### Why slices, not the whole tree

A 10,000-person tree serialized to JSON would blow the context window and slow
every turn. By sending only the relevant slice:

- **Relationship** questions need a *path*, not the population — so we send the
  ~2–20 people on it.
- **Biographical** questions need one family neighbourhood.
- **Aggregate** questions genuinely need everyone, but only a few fields each
  (nulls stripped), which stays compact.

---

## Relationship BFS ([`lib/relationship.ts`](../lib/relationship.ts))

`buildAdjacency()` turns the family records into a bidirectional graph:

- husband ↔ wife → `spouse`
- parent → child → `parent`
- child → parent → `child`

`findPath()` runs a standard breadth-first search (max depth 20) and
reconstructs the shortest chain as `PathStep[]`, where each step's
`relationToNext` labels the edge to the following person. The model receives the
full records of everyone on the path plus those labels, and narrates the
relationship from them. No path → `relationshipPath: null`, and the prompt tells
the model to say so.

---

## Parsing pipeline ([`lib/gedcom-parser.ts`](../lib/gedcom-parser.ts))

```
raw text
  │ split on \r?\n
  ▼
reassembleContinuations()   fold CONT (newline) / CONC (no separator) into parent
  │
  ▼
buildRecordTree()           level-walk flat lines into nested record nodes
  │
  ▼
parseIndividual / parseFamily   extract typed shapes; normalize @X@ → X
  │
  ▼
TreeData { individuals, families }
```

Robustness details:

- **Duplicate events** (some records carry two `BIRT` blocks) → the **first** is
  used.
- **Dates** are free-form; `extractYear()` pulls the first plausible 4-digit
  year (1000–2100) for span/temporal logic, while the original string is kept
  for display and for the model.
- **Cross-reference IDs** (`@I48114428611@`) are normalized by stripping `@`.

---

## State machine ([`app/page.tsx`](../app/page.tsx))

```
        ┌─────────┐  file ok   ┌──────────┐  ask / suggested  ┌────────┐
        │ upload  │ ─────────▶ │ summary  │ ────────────────▶ │  chat  │
        └─────────┘            └──────────┘                   └────────┘
             ▲                       │                             │
             │  "Try another file"   │  >50MB / parse error        │ "New file"
             │                       ▼                             │
             └──────────────────  error  ◀────────────────────────┘
```

A suggested-question tap transitions straight to `chat` with the question passed
as `initialQuestion`; `ChatScreen` fires it once via `append` in a
ref-guarded `useEffect` (safe under React StrictMode's double-invoke).
