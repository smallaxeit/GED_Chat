# Design

A warm, archival, "old paper and lamplight" feel — genealogy is about the past,
so the palette leans into aged parchment and candle-gold rather than the cold
blue of typical SaaS.

---

## Colour tokens

Defined as CSS custom properties in [`app/globals.css`](../app/globals.css) and
mirrored into Tailwind via [`tailwind.config.ts`](../tailwind.config.ts), so you
can write `bg-surface`, `text-muted`, `border-accent`, etc.

| Token       | Value     | Role                                            |
| ----------- | --------- | ----------------------------------------------- |
| `--bg`      | `#1a1714` | App background — near-black warm brown          |
| `--surface` | `#241f1b` | Cards, user bubbles, inputs                     |
| `--text`    | `#f4efe8` | Primary text — warm off-white                   |
| `--muted`   | `#8a8078` | Secondary text, labels, placeholders            |
| `--accent`  | `#c9a86c` | Gold — headings highlights, focus, CTAs, cursor |
| `--border`  | `#2e2824` | Hairlines, dashed upload zone, chip outlines    |

```
 bg #1a1714   surface #241f1b   border #2e2824   muted #8a8078   accent #c9a86c   text #f4efe8
 ███████████  ███████████████   ██████████████   ██████████████  ███████████████  ████████████
```

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

### Summary ([`summary-screen.tsx`](../components/summary-screen.tsx))

- Three stat cards (people, families, years covered) with gold Playfair
  numerals.
- Top surnames as outlined **chips**, each with a muted count.
- Suggested-question buttons — full-width, left-aligned, border brightens to
  gold on hover.
- A primary gold CTA to jump into free-form chat.

### Chat ([`chat-screen.tsx`](../components/chat-screen.tsx))

- **User bubbles**: right-aligned, `--surface` background, rounded with a
  squared bottom-right corner.
- **Assistant messages**: left-aligned, *no* background, a subtle `--accent`
  left border — they read like annotations in a ledger rather than chat bubbles.
- **Streaming cursor**: a gold block that pulses (`cursor-pulse`, 1s steps)
  after the last streaming token, and stands alone while the assistant's reply
  is still pending.
- Sticky header (title + "New file" reset) and a bottom input row with a gold
  "Ask" button that disables when empty or mid-stream.
- The message list auto-scrolls to the newest content as tokens arrive.

---

## Interaction details

- **Focus states** use the gold accent (`focus:border-accent`) rather than the
  browser default outline.
- **Hover** consistently means "border/text → accent" — one rule across chips,
  suggestions, and reset buttons.
- **Disabled** controls drop to 40% opacity with a `not-allowed` cursor.
- **Custom scrollbar** (WebKit) is themed: track `--bg`, thumb `--border`,
  hover `--accent`.

---

## Accessibility notes

- Upload zone is keyboard-operable and labelled by its visible text.
- Colour is never the *only* signal — disabled state also changes the cursor,
  drag state also tints the surface, counts are shown as text.
- Contrast: `--text` on `--bg` and on `--surface` both clear AA for body text;
  `--muted` is reserved for secondary, non-essential labels.

> Possible future polish: render assistant markdown (currently shown as
> pre-wrapped plain text via `.message-body`), and add `aria-live` on the
> streaming region.
