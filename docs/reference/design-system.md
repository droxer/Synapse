# Design system

Synapse's UI follows the Linear-inspired system defined in [`/DESIGN.md`](../../DESIGN.md): Inter Variable, a neutral cool-gray palette with one indigo accent, sharp 4px CTAs, tonal surfaces, and a near-black dark theme.

Live token source: [`web/src/app/globals.css`](../../web/src/app/globals.css).
Authoritative spec: [`DESIGN.md`](../../DESIGN.md).
Live gallery: `/design-system` (dev-only route). Visual fixture: `/design-review` (dev-only, no auth).

The file is structured as:
- `@theme` block — registers Tailwind v4 design tokens.
- `:root` — light-mode values.
- `.dark` — dark-mode overrides (Linear near-black; sidebar darker than canvas).

---

## Core principles

- **Indigo is the only brand fill.** `--color-indigo` (`#5e6ad2`) belongs on the primary action of a view, focus rings, selection, and progress. Use `text-info` — not `text-primary` — when indigo renders as text (it lightens to `#828fff` in dark mode for AA).
- **CTAs are sharp.** Buttons, icon buttons, toggles, segmented-tab triggers, and suggestion chips use `rounded-sm` (4px); `xs` buttons use `rounded-xs` (2px). Fields and list rows use `rounded-md` (6px). Never pill-shape a button.
- **Dense by default.** UI copy is 13px (`text-sm` / `text-body-sm`), reading copy 15px (`text-body-md`). Controls are 32px tall (`h-8`); rows are ~28–32px.
- **Light, few lines.** Surfaces separate by tonal fill (`canvas` → `surface-soft` → `surface-hover`) and whitespace — not hairlines. Borders are reserved for `Input`, `Textarea`, `Select`, the composer, and the explicit opt-in `Card variant="outlined"` / `Badge variant="outline"`. Overlays get their edge from the 1px ring inside `shadow-elevated`.
- **Inter features always on.** `cv01` + `ss03` are set on `body` and all heading roles.

Legacy semantic aliases (`--color-background`, `--color-foreground`, `--color-primary`, …) are kept so the component layer compiles unchanged; each resolves to a canonical token. New code should consume the canonical names.

---

## Colors

### Accent

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-indigo` | `#5e6ad2` | `#5e6ad2` | Primary fill (`bg-primary`). White text 4.7:1. |
| `--color-indigo-deep` | `#5360c7` | `#6b76da` | Primary hover; dark focus ring. |
| `--color-indigo-selected` | `#4652bb` | `#7c86e0` | Primary pressed. |
| `--color-indigo-soft` | `#7170ff` | `#828fff` | Streaming cursor / AI glow (dark). |
| `--color-indigo-text` (`--color-info`) | `#5e6ad2` | `#828fff` | Links, info badges, indigo icons. |
| `--color-violet` | `#8e5bd8` | `#b18cf0` | Syntax highlighting keywords only. |
| `--color-ink-button` | `#18191b` | `#f7f8f8` | `marketing` button fill (inverts in dark). |

### Surface

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-canvas` | `#ffffff` | `#0f1011` | Page / content background. |
| `--color-surface-soft` | `#f5f6f8` | `#17181a` | Sidebar (light), muted, secondary buttons, cards (dark). |
| `--color-surface-hover` | `#eceef1` | `#202124` | Hover, selected rows, `accent`, Kbd. |
| `--color-sidebar-bg` | = surface-soft | `#090a0b` | Sidebar — darker than canvas in dark. |
| `--color-popover` | `#ffffff` | `#1b1c1f` | Menus, dialogs, popovers. |
| `--color-hairline` | `#dfe1e5` | `#2a2c31` | Input border. |
| `--color-hairline-soft` | `#ebecef` | `#1f2023` | Composer / outlined card border. |

### Text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-ink-deep` | `#18191b` | `#f7f8f8` | Primary text (`foreground`). |
| `--color-ink` | `#2c2d31` | `#e3e4e6` | Body text on tinted fills. |
| `--color-steel` | `#5f636a` | `#8a8f98` | Secondary text (`muted-foreground`). |
| `--color-stone` | `#71757d` | `#7a7f88` | Tertiary / placeholder (≥4.5:1). |
| `--color-disabled-text` | `#b8bbc1` | `#484b51` | Disabled labels. |

### Semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-success` / `success-text` | `#4cb782` / `#1d7a4f` | `#4cb782` | Done, connected. |
| `--color-attention` | `#f2994a` | `#f2994a` | In-progress / mid-priority. |
| `--color-warning` / `warning-text` | `#f2c94c` / `#8a5a00` | `#f2c94c` | Warnings. |
| `--color-critical` | `#d4373e` | `#eb5757` | Errors, destructive fill, `destructive` text. |

Run `npm run audit:wcag` after any color change — it resolves `var()` aliases and checks foreground, muted, dim, primary-button, destructive, info, success/warning text, and sidebar/card pairs in both themes.

---

## Typography

**Font stack.** `--font-sans` is Inter Variable (Latin subset bundled from `@fontsource-variable/inter` via `next/font/local`, exposed as `--font-inter`) → system sans → `--font-cjk-sans` (PingFang SC → Hiragino Sans GB → Microsoft YaHei → Noto Sans CJK SC). Code uses Geist Mono via `--font-mono`.

`--text-sm` is 13px and `--text-base` is 15px, so plain Tailwind `text-sm` / `text-base` follow Linear's scale.

### Roles

| Utility | Size | Weight | LH | Tracking |
|---|---|---|---|---|
| `text-hero-display` | clamp(40px, 5vw, 64px) | 510 | 1.06 | -0.032em |
| `text-display-lg` | clamp(32px, 4vw, 48px) | 510 | 1.1 | -0.028em |
| `text-heading-lg` | 28px → 36px at ≥768px | 590 | 1.2 → 1.15 | -0.022 → -0.025em |
| `text-heading-md` | 24px | 590 | 1.3 | -0.018em |
| `text-heading-sm` | 20px | 590 | 1.33 | -0.012em |
| `text-subtitle-lg` | 17px | 590 | 1.45 | -0.008em |
| `text-subtitle-md` | 17px | 400 | 1.6 | -0.006em |
| `text-body-md` | 15px | 400 | 1.6 | -0.004em |
| `text-body-md-bold` | 15px | 590 | 1.6 | -0.004em |
| `text-body-sm` | 13px | 400 | 1.5 | 0 |
| `text-body-sm-bold` | 13px | 510 | 1.5 | 0 |
| `text-caption-bold` | 12px | 510 | 1.33 | 0 |
| `label-section` | 12px | 510 | 1.33 | 0 (sentence case, tabular nums) |
| `text-button-md` / `text-link-md` | 13px | 510 | 1.43 | 0 |

`:lang(zh)` steps display sizes down and relaxes tracking.

**Weights.** 400 / 510 / 590 / 680 — `font-medium`, `font-semibold`, `font-bold` are remapped to the last three. Prefer the role utilities.

**12px floor.** Nothing renders below 12px.

---

## Radius scale

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 2px | xs buttons, icon-xs, inline chip controls. |
| `--radius-sm` | 4px | **All CTAs**: buttons, icon buttons, toggles, tab triggers, suggestion chips, Kbd. |
| `--radius-md` | 6px | Inputs, selects, textareas, menu / list / sidebar rows, segmented track. |
| `--radius-lg` | 8px | Code blocks, thumbnails. |
| `--radius-xl` | 10px | Cards, composer, message bubbles. |
| `--radius-xxl` (`2xl`) | 12px | Overlays (`surface-overlay`). |
| `--radius-xxxl` / `feature` | 16 / 20px | Rare large showcase tiles. |
| `--radius-full` / `circle` | 9999px | Badges, avatars, dots, progress tracks, switches. |

---

## Elevation

| Token | Use |
|---|---|
| `shadow-xs` | Primary / secondary buttons, active segmented tab, resting composer. |
| `shadow-elevated` | Overlays, drawers, welcome composer — includes a 1px ring (6% ink light / 7% white dark). |
| `shadow-sticky-rail` | `card-checkout-summary` only. |

---

## Spacing scale

4px base unit. Named steps (`--spacing-xxs` 4 … `--spacing-hero` 120) remain registered. In product UI, rows use `px-2 py-1.5`, cards `p-5`, dialogs `p-5`.

---

## Components

Pull from `@/shared/components/ui`. Keep the `/design-system` gallery in sync when a variant changes.

### Buttons (`Button`)

| Variant | Use |
|---|---|
| `default` | Indigo primary + `shadow-xs`. One per view. |
| `secondary` | `surface-soft` tonal fill + `shadow-xs`; hover → `surface-hover`. |
| `ghost` | Transparent, muted text; hover → `surface-hover` + foreground. Toolbars. |
| `destructive` | `critical` fill with `on-destructive` text. |
| `marketing` | Ink fill (inverts in dark). Login / landing. |
| `link` | `text-info`, underline on hover. |
| Sizes | `xs` 24 (2px radius) / `sm` 28 / `default` 32 / `lg` 36 / `tab` 28; `icon-xs` 24 / `icon-sm` 28 / `icon` 32 / `icon-lg` 36 — sharp squares. |

All variants are `rounded-sm` — don't override with softer radii at call sites.

### Cards (`Card`, `variant="…"`)

`default` (card fill, 10px, borderless), `sunken` (muted), `interactive` (gains `shadow-elevated` on hover), `outlined` (opt-in 1px border for same-tone surfaces), `panel` (8px legacy alias). Header/content/footer use `px-5`; card gap is 16px; title is `text-body-md-bold`.

### Inputs (`Input`, `Textarea`, `Select`)

32px (`h-8`), `rounded-md`, 1px `input` border, `text-body-sm`. Focus → `border-border-active` + `shadow-glow-subtle` (3px indigo halo, no layout shift). 44px min-height on coarse pointers.

### Badges (`Badge`)

20px pill, `text-caption-bold`, tonal fill: `neutral`, `success`, `warning`, `danger`, `info`, `accent`, and bordered `outline`.

### Tabs (`Tabs`, `TabsList variant="…"`)

`default` — segmented: 6px muted track, 4px 28px triggers; active is `bg-background` + `shadow-xs` (`surface-hover` in dark). `line` — rounded 2px underline indicator.

### Menus, Kbd, Tooltip

Dropdown / select rows: `rounded-md px-2 py-1.5`, focus `bg-accent` (`surface-hover`); group labels `text-caption` muted. `Kbd`: 20px keycap, `surface-hover`, `rounded-sm`, Inter 12px. Tooltip: inverted `foreground` fill, `rounded-md`.

---

## Do's and Don'ts

### Do

- Keep indigo scarce; use `text-info` for indigo text.
- Keep every CTA `rounded-sm`.
- Separate surfaces with tonal fill and spacing.
- Use `label-section` for section labels (sentence case).
- Run `npm run audit:wcag` and `npm run audit:design-tokens` before shipping token changes.

### Don't

- Don't pill-shape buttons, rows, or segmented controls.
- Don't add hairline dividers between regions or borders on tinted fills.
- Don't use uppercase tracked eyebrows, gradients, blur, or decorative shapes.
- Don't go below 12px or use off-scale weights.

---

## Responsive contract

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | `<768px` | Sidebar → drawer; agent panel → full-screen sheet; `touch-target` restores 44px. |
| Tablet | `768–1023px` | Sidebar collapsible; agent panel overlays. |
| Desktop | `≥1024px` | Sidebar + conversation + agent panel (`--agent-panel-width` 44%). |

Touch targets: 44px for buttons, inputs, and selects on coarse pointers (global `[data-slot=…]` overrides + `touch-target`).

---

## Known gaps

- Inter is bundled for Latin only; Cyrillic/Greek/Vietnamese fall back to the system sans.
- `card-product-feature` / `card-promo-strip` / `card-warranty` utilities from the previous system are retained (now on the tighter radius scale) but unused in product UI.
- `FilePreview` iframe tokens mirror canvas/surface hex values by hand — update them alongside `globals.css`.
