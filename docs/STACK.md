# Stack

Deliberately small. Every dependency earns its place; nothing is here "just in
case."

---

## Runtime dependencies

| Package             | Version  | Why it's here                                                                 |
| ------------------- | -------- | ----------------------------------------------------------------------------- |
| `next`              | ^14.2.35 | App Router, API route handlers, streaming responses, `next/font`.             |
| `react` / `react-dom` | ^18.3  | UI. Concurrent features + StrictMode (which we explicitly guard against).     |
| `ai`                | ^4.0.0   | Vercel AI SDK — `streamText` on the server, `useChat` on the client.          |
| `@ai-sdk/anthropic` | ^1.0.0   | The Anthropic provider for the AI SDK — `anthropic('claude-sonnet-4-6')`.     |

## Dev dependencies

| Package                          | Why                                              |
| -------------------------------- | ------------------------------------------------ |
| `typescript`                     | Strict mode across the whole codebase.           |
| `@types/node`, `@types/react`, `@types/react-dom` | Types.                      |
| `tailwindcss`, `postcss`, `autoprefixer` | Styling pipeline.                        |

---

## Deliberately NOT used

- **No database / ORM** — the server is stateless by design
  (see [`ARCHITECTURE.md`](ARCHITECTURE.md)).
- **No GEDCOM library** — the parser is hand-written in
  [`lib/gedcom-parser.ts`](../lib/gedcom-parser.ts). Real-world GEDCOM is messy
  in specific ways (duplicate events, wild date formats); a focused parser we
  control beats a general dependency here.
- **No session / auth library** — there is no server-side session to manage.
- **No state-management library** — a handful of `useState` hooks in
  [`page.tsx`](../app/page.tsx) plus `useChat` is all that's needed.
- **No markdown renderer** (yet) — assistant text is shown as pre-wrapped plain
  text. Easy to add later if desired.

---

## Key APIs leaned on

### `streamText` (server)

[`app/api/chat/route.ts`](../app/api/chat/route.ts) calls `streamText` with the
model, the system prompt (which embeds the context payload), and the message
history, then returns `result.toDataStreamResponse()`.

### `useChat` + `experimental_prepareRequestBody` (client)

[`components/chat-screen.tsx`](../components/chat-screen.tsx) uses the
`experimental_prepareRequestBody` hook rather than the static `body` option,
because the request body must be **recomputed per message** — each question
needs its own freshly-built context slice:

```ts
useChat({
  api: '/api/chat',
  experimental_prepareRequestBody({ messages }) {
    const lastUserMessage = messages.filter(m => m.role === 'user').at(-1)
    const context = lastUserMessage
      ? buildContext(lastUserMessage.content, treeData)
      : {}
    return { messages, context }
  },
})
```

### `next/font/google`

Playfair Display and DM Sans are self-hosted at build time and exposed as CSS
variables, so there's no layout shift and no runtime font request.

---

## Runtime & environment

- **Route runtime:** `nodejs` for both API routes (the parser uses standard
  JS; chat streams fine on Node).
- **`maxDuration = 30`** on the chat route to allow longer streamed answers.
- **Model:** `claude-sonnet-4-6` — fast, strong reasoning over structured
  context, well-suited to grounded Q&A.
- **Env:** `ANTHROPIC_API_KEY` in `.env.local`, read server-side only. It is
  **never** referenced in client code.

---

## Versioning note

The spec pinned `next@14.2.5`, which has a published security advisory. This
project uses `^14.2.35` (a patched 14.2.x) to pick that up while staying on the
same App Router major. No API changes were required.
