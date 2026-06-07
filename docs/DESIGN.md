# Design

A light, archival "parchment and ink" feel — genealogy is about the past, so the
palette leans into warm cream paper, ink text, and a calm slate-blue accent
rather than the cold flat white (or harsh dark) of typical SaaS.

---

## Colour tokens

Stored as **raw RGB channel triplets** in
[`app/globals.css`](../app/globals.css) (e.g. `--bg: 250 247 240;`) and consumed
through Tailwind via `rgb(var(--x) / <alpha-value>)` in
[`tailwind.config.ts`](../tailwind.config.ts). The channel-triplet form is what
makes opacity modifiers (`bg-surface/40`, `border-accent/50`) resolve correctly
— a bare `var(--x)` hex silently breaks them.

| Token       | Value     | Role                                              |
| ----------- | --------- | ------------------------------------------------- |
| `--bg`      | `#faf7f0` | App background — warm cream paper                 |
| `--surface` | `#ffffff` | Cards, user bubbles, inputs                       |
| `--text`    | `#2a2622` | Primary text — near-black ink                     |
| `--muted`   | `#7a736a` | Secondary text, labels, placeholders              |
| `--accent`  | `#3f6b7d` | Slate blue — highlights, focus, CTAs, cursor      |
| `--border`  | `#e6ded0` | Faint sepia — hairlines, dashed zone, chip edges  |

```
 bg #faf7f0   surface #ffffff   border #e6ded0   muted #7a736a   accent #3f6b7d   text #2a2622
 ███████████  ███████████████   ██████████████   ██████████████  ███████████████  ████████████
```

> Swapping the whole theme is a six-line edit: change the triplets in `:root`.
> Every screen reads from these tokens, so nothing else needs touching.

---

## Typography

Loaded via `next/font/google` in [`app/layout.tsx`](../app/layout.tsx) and
exposed as CSS variables.

- **Playfair Display** (`--font-playfair`) — headings. A high-contrast serif
  that reads like an engraved family record.
- **DM Sans** (`--font-dmsans`) — body, UI, and chat. A clean, neutral sans for
  long reading.

`h1/h2/h3` and `.font-heading` default to Playfair; `body` defaults to DM Sans.

---

## Screens

### Upload ([`upload-screen.tsx`](../components/upload-screen.tsx))

- Centered hero with a Playfair headline.
- A **dashed-border drop zone**. On drag-over the border shifts from `--border`
  to `--accent` and the surface tints — clear "let go here" affordance.
- Click or keyboard (Enter/Space) opens the file picker; the whole zone is a
  `role="button"`, `tabIndex=0` target.
- While parsing, the zone shows "Parsing your tree…" and goes
  non-interactive.

### Summary — the hub ([`summary-screen.tsx`](../components/summary-screen.tsx))

The summary doubles as the home base for everything else.

- A **front-and-centre question box** is the hero: a large autofocused input +
  accent "Ask" button that drops straight into chat.
- **Suggested-question chips** sit just below — and **collapse/fade out the
  moment you start typing** (200ms), so the prompt gets the whole stage.
- Three **stat tiles**: **People** and **Families** are buttons (accent hover,
  `→` affordance) that open the list screens; **Years** is static.

### People / Families ([`people-screen.tsx`](../components/people-screen.tsx), [`families-screen.tsx`](../components/families-screen.tsx))

- A header with an **← Overview** back button and a live count.
- **People**: name-filter box, then everyone sorted by surname with lifespan and
  birthplace on the right. People list rows are buttons — tapping asks
  *"Tell me about \<name\>."*
- **Families**: couples sorted by marriage year, with marriage year and child
  count. Tapping asks about that family.
- Rows use a hover colour shift to accent; no heavy row backgrounds, just hairline
  dividers — keeps long lists calm.

### Chat ([`chat-screen.tsx`](../components/chat-screen.tsx))

- **User bubbles**: right-aligned, `--surface` (white) background, rounded with a
  squared bottom-right corner.
- **Assistant messages**: left-aligned, *no* background, a subtle `--accent`
  left border — they read like annotations in a ledger rather than chat bubbles.
- **Rendered Markdown** (see below) — lists, tables, headings, code, and
  blockquotes, all themed to the parchment palette.
- **Streaming cursor**: an accent block that pulses (`cursor-pulse`, 1s steps)
  after the last streaming token, and stands alone while the assistant's reply
  is still pending.
- Header carries **← Overview** (back to the hub) and **New file** (full reset);
  a bottom input row with an accent "Ask" button that disables when empty or
  mid-stream.
- The message list auto-scrolls to the newest content as tokens arrive.

---

## Markdown styling

Assistant replies are rendered with `react-markdown` + `remark-gfm` and styled
entirely by hand in [`globals.css`](../app/globals.css) under `.message-body`
(no `@tailwindcss/typography` — its defaults fight a custom theme). Highlights:

- **Headings** in Playfair, sized down to sit inside a chat column.
- **Bulleted lists** get custom accent dots; **ordered lists** get accent markers.
- **Inline code / code blocks** on `--surface` with a sepia border.
- **Tables** with sepia gridlines and a tinted header row.
- **Blockquotes** with an accent bar; first/last margins collapsed so bubbles
  aren't top- or bottom-heavy.

---

## Interaction details

- **Focus states** use the accent (`focus:border-accent` + `caret-accent`)
  rather than the browser default outline.
- **Hover** consistently means "border/text → accent" — one rule across tiles,
  chips, list rows, and header buttons.
- **Disabled** controls drop to 40% opacity with a `not-allowed` cursor.
- **Custom scrollbar** (WebKit) is themed: track `--bg`, thumb `--border`,
  hover `--accent`.

---

## Accessibility notes

- Upload zone is keyboard-operable and labelled by its visible text.
- Colour is never the *only* signal — disabled state also changes the cursor,
  drag state also tints the surface, counts are shown as text, tiles carry a `→`.
- Contrast: ink `--text` on cream `--bg` and white `--surface` clears AA for body
  text; `--muted` is reserved for secondary, non-essential labels.

> Possible future polish: `aria-live` on the streaming region, and an optional
> lighter-weight style for parenthetical maiden names in lists.
