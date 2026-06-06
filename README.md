# Family Tree Q&A

Upload a GEDCOM (`.ged`) file and ask plain-English questions about your family
tree. Births, deaths, marriages, places, and "how is X related to Y" — answered
by Claude, grounded strictly in your data.

No database. No third-party GEDCOM library. The server holds **no state** — your
parsed tree lives in the browser, and every chat request carries its own
pre-built context.

![status](https://img.shields.io/badge/build-passing-c9a86c) ![next](https://img.shields.io/badge/Next.js-14-1a1714) ![ai-sdk](https://img.shields.io/badge/Vercel%20AI%20SDK-v4-1a1714)

---

## Quick start

```bash
# 1. Install
npm install

# 2. Add your Anthropic key
#    .env.local already exists — paste your key into it:
#    ANTHROPIC_API_KEY=sk-ant-...

# 3. Run
npm run dev
# → http://localhost:3000
```

Get a key at <https://console.anthropic.com/settings/keys>.

---

## How it works

```
Upload .ged ──▶ /api/upload ──▶ TreeSummary + TreeData
                  (parse only,        │
                   no storage)        ▼
                              React state (browser)
                                      │
   "How is Ann related to John?"      │
            │                         ▼
            ▼                 buildContext(question, treeData)
      experimental_prepareRequestBody  │  classify → relationship / biographical
            │                         │             / aggregate / temporal / fallback
            ▼                         ▼
        /api/chat ◀── { messages, context } ── (compact, question-specific slice)
            │
            ▼
   streamText(Claude)  ──▶  grounded answer, streamed token-by-token
```

The model only ever sees a small, relevant slice of the tree — not the whole
file — so answers stay fast and grounded.

---

## Features

- **Hand-written GEDCOM parser** — CONT/CONC reassembly, level-walking, name
  parsing, tolerant of the many real-world date formats (`08 25 1979`,
  `abt 1980`, `1 Nov 1971`, `06 JUN 1809`, `01/14/2017`).
- **Five-way question routing** — relationship, biographical, aggregate,
  temporal, and a fallback, each building a differently-shaped context.
- **BFS relationship finder** — shortest path between any two people with
  labelled spouse / parent / child edges.
- **Verified suggestions** — the three starter questions are checked against
  your actual data; the app never suggests a question it can't answer.
- **Streaming chat** with a pulsing cursor, grounded by a strict system prompt.

---

## Project layout

```
app/
  layout.tsx              Fonts + root shell
  page.tsx                'use client' state machine: upload | summary | chat | error
  globals.css             Theme tokens, scrollbar, streaming cursor
  api/
    upload/route.ts       POST: parse GEDCOM → TreeSummary + TreeData
    chat/route.ts         POST: { messages, context } → streamed answer

lib/
  types.ts                Individual, Family, TreeData, TreeSummary, Edge, PathStep
  gedcom-parser.ts        reassembleContinuations(), parseGedcom(), parseName(), extractYear()
  relationship.ts         buildAdjacency(), findPath() — BFS
  context-builder.ts      classifyQuestion(), matchNames(), buildContext()

components/
  upload-screen.tsx       Drag-and-drop upload zone
  summary-screen.tsx      Tree stats + suggested questions
  chat-screen.tsx         useChat + per-request context injection

docs/
  ARCHITECTURE.md         Data flow, statelessness, the five context branches
  DESIGN.md               Visual language, tokens, component behaviour
  STACK.md                Dependencies and why each is here
  NOTES.md                Decisions, trade-offs, edge cases, known limits
```

---

## Scripts

| Command         | What it does                              |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Start the dev server on :3000             |
| `npm run build` | Production build + full type-check        |
| `npm run start` | Serve the production build                |
| `npm run lint`  | Next.js / ESLint                          |

---

## Privacy

Your GEDCOM file is parsed in a single request and **never stored** on the
server. The parsed tree lives only in your browser tab; refreshing clears it.
Chat requests send only the small, question-specific context slice to the
Anthropic API — never the whole file at once. Your API key stays server-side and
is never exposed to client code.

---

## Constraints

- Files up to **50 MB** (rejected client-side before upload).
- Tuned and tested against GEDCOM 5.5.1 exports (e.g. Ancestry.com).
- Requires an `ANTHROPIC_API_KEY` for chat; upload/summary work without one.

See [`docs/NOTES.md`](docs/NOTES.md) for known limitations and edge cases.
