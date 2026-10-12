---
version: beta
name: Synapse-linear
description: Synapse's product UI follows Linear's design language — a calm, dense, keyboard-first tool aesthetic. The native system sans stack (SF Pro / Segoe UI, with the OS CJK face) at 13px for UI and 15px for reading, a neutral cool-gray palette with a single indigo accent (#5e6ad2), sharp 4px CTAs on 6px fields, tonal surface separation, and a signature near-black dark theme where the sidebar sits darker than the content canvas.

colors:
  # Light
  canvas: "#ffffff"
  surface-soft: "#f5f6f8"
  surface-hover: "#eceef1"
  ink-deep: "#18191b"
  ink: "#2c2d31"
  charcoal: "#3c3e44"
  slate: "#50535a"
  steel: "#5f636a"
  stone: "#71757d"
  hairline: "#dfe1e5"
  hairline-soft: "#ebecef"
  disabled-text: "#b8bbc1"
  ink-button: "#18191b"
  on-ink-button: "#ffffff"
  indigo: "#5e6ad2"
  indigo-deep: "#5360c7"
  indigo-soft: "#7170ff"
  indigo-selected: "#4652bb"
  indigo-text: "#5e6ad2"
  on-indigo: "#ffffff"
  violet: "#8e5bd8"
  success: "#4cb782"
  success-text: "#1d7a4f"
  attention: "#f2994a"
  warning: "#f2c94c"
  warning-text: "#8a5a00"
  critical: "#d4373e"
  critical-strong: "#c42f36"

colors-dark:
  canvas: "#0f1011"
  sidebar-bg: "#090a0b"
  surface-soft: "#17181a"
  surface-hover: "#202124"
  popover: "#1b1c1f"
  ink-deep: "#f7f8f8"
  ink: "#e3e4e6"
  charcoal: "#d0d6e0"
  slate: "#b4b8c0"
  steel: "#8a8f98"
  stone: "#7a7f88"
  hairline: "#2a2c31"
  hairline-soft: "#1f2023"
  indigo: "#5e6ad2"
  indigo-deep: "#6b76da"
  indigo-text: "#828fff"
  violet: "#b18cf0"
  critical: "#eb5757"

typography:
  fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif (CJK from the OS: PingFang SC / Microsoft YaHei / Noto Sans CJK SC)
  monoFamily: ui-monospace, SFMono-Regular, Menlo, Consolas (system mono)
  hero-display:   { fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 500, lineHeight: 1.06, letterSpacing: -0.032em }
  display-lg:     { fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 500, lineHeight: 1.1,  letterSpacing: -0.028em }
  heading-lg:     { fontSize: "28px → 36px",            fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.025em }
  heading-md:     { fontSize: 24px, fontWeight: 600, lineHeight: 1.3,  letterSpacing: -0.018em }
  heading-sm:     { fontSize: 20px, fontWeight: 600, lineHeight: 1.33, letterSpacing: -0.012em }
  subtitle-lg:    { fontSize: 17px, fontWeight: 600, lineHeight: 1.45 }
  subtitle-md:    { fontSize: 17px, fontWeight: 400, lineHeight: 1.6 }
  body-md:        { fontSize: 15px, fontWeight: 400, lineHeight: 1.6 }
  body-md-bold:   { fontSize: 15px, fontWeight: 600, lineHeight: 1.6 }
  body-sm:        { fontSize: 13px, fontWeight: 400, lineHeight: 1.5 }
  body-sm-bold:   { fontSize: 13px, fontWeight: 500, lineHeight: 1.5 }
  caption-bold:   { fontSize: 12px, fontWeight: 500, lineHeight: 1.33 }
  label-section:  { fontSize: 12px, fontWeight: 500, lineHeight: 1.33, note: "sentence case, tabular figures" }
  button-md:      { fontSize: 13px, fontWeight: 500, lineHeight: 1.43 }
  link-md:        { fontSize: 13px, fontWeight: 500, lineHeight: 1.43 }

rounded:
  xs: 2px
  sm: 4px      # every CTA: buttons, icon buttons, toggles, tab triggers
  md: 6px      # fields and rows: inputs, selects, menu/list rows
  lg: 8px
  xl: 10px
  xxl: 12px
  xxxl: 16px
  feature: 20px
  full: 9999px

spacing: { base-unit: 4px, xxs: 4px, xs: 8px, sm: 10px, md: 12px, base: 16px, lg: 20px, xl: 24px, xxl: 32px, xxxl: 40px }

elevation:
  flat: none
  xs: "0 1px 2px rgba(15,16,17,.05)"
  elevated: "0 0 0 1px rgba(15,16,17,.06), 0 4px 16px -2px rgba(15,16,17,.10), 0 2px 4px -2px rgba(15,16,17,.06)"
  elevated-dark: "0 0 0 1px rgba(255,255,255,.07), 0 8px 24px -4px rgba(0,0,0,.55), 0 2px 6px -2px rgba(0,0,0,.4)"

motion:
  fast: 100ms ease-out      # hover / press
  base: 150ms ease-out      # overlays, popovers, dialogs
  reveal: "250ms cubic-bezier(0.22, 1, 0.36, 1)"
---

## Overview

Synapse is a tool people sit in for hours, so the UI borrows Linear's design language: it should feel fast, quiet, and precise. Content and keyboard flow come first. Chrome recedes into neutral grays, and one indigo accent marks the action that matters.

**Key characteristics**
- **One accent.** Indigo ({colors.indigo}) is the only brand fill. It goes on the primary action of a view, on focus rings, and on selection. Everything else is gray.
- **Dense, legible type.** The native system sans stack, same for English and Chinese. UI copy sits at 13px/400–500 and reading copy (chat, docs) at 15px/1.6. Headings use 600 with tight negative tracking.
- **Sharp geometry.** Every CTA (buttons, icon buttons, toggles, tab triggers) uses a crisp 4px radius at 32px tall by default. Fields and list rows use 6px, cards 10px, and overlays 12px. Only badges, avatars, status dots, and progress tracks are fully round.
- **Tone, not lines.** Surfaces separate by small steps in fill (canvas → surface-soft → surface-hover) and by whitespace. Hairlines are reserved for form inputs and the composer. Overlays get a 1px *shadow ring* instead of a border.
- **Near-black dark mode.** The dark theme is the signature: the sidebar ({colors-dark.sidebar-bg}) sits darker than the canvas ({colors-dark.canvas}), raised surfaces step up by ~4% luminance, and text is cool off-white.
- **Quick motion.** Hover feedback takes 100ms and overlays 150ms. Nothing bounces or floats.

## Colors

### Accent
| Token | Light | Dark | Use |
|---|---|---|---|
| `indigo` | #5e6ad2 | #5e6ad2 | Primary button fill, selection, progress. White text passes AA (4.7:1). |
| `indigo-deep` | #5360c7 | #6b76da | Hover on primary; focus ring in dark. |
| `indigo-selected` | #4652bb | #7c86e0 | Pressed / active primary. |
| `indigo-text` → `info` | #5e6ad2 | #828fff | Indigo **as text** (links, info badges). Dark uses a lighter tint for AA on near-black. |
| `violet` | #8e5bd8 | #b18cf0 | Syntax highlighting only. |

Use `text-info` (not `text-primary`) whenever indigo is used as a text or icon color.

### Neutrals
`ink-deep` (primary text) → `ink` → `charcoal` → `slate` → `steel` (secondary text, `muted-foreground`) → `stone` (tertiary / placeholder, still ≥4.5:1) → `disabled-text`.
Surfaces: `canvas` (content) · `surface-soft` (sidebar, muted, secondary buttons, cards in dark) · `surface-hover` (hover, selected rows, `accent`) · `hairline` / `hairline-soft` (input and composer edges only).

### Semantic
Linear's status hues: success #4cb782, attention #f2994a, warning #f2c94c, critical #d4373e (light) / #eb5757 (dark). Use the AA text tokens `success-text` / `warning-text` whenever those hues render as text.

## Typography

- **Families.** No web fonts. `--font-sans` is the native system stack (matching eveland.ai): SF Pro / Segoe UI / Roboto for Latin, and the OS CJK face (PingFang SC, Microsoft YaHei, Noto Sans CJK) for Chinese. Code uses the system monospace stack.
- **Weights.** 400 / 500 / 600 / 700 (`font-normal` / `font-medium` / `font-semibold` / `font-bold` resolve to these). Don't hand-roll other weights.
- **Floor.** Nothing renders below 12px.
- **Labels.** Section labels use `label-section` (12px/500, sentence case). No uppercase-tracked eyebrows.
- **CJK.** `:lang(zh)` steps display sizes down and relaxes tracking to ~0.

## Layout

A 4px base unit. Rows in lists and menus are 28–32px tall (`py-1.5`), toolbars are 32–40px, and page gutters run 16–24px. Content columns cap at ~680px for reading and ~1040px for settings and grids.

## Elevation

Default surfaces are flat. Two shadows exist:
- `shadow-xs` gives a 1px soft lift for primary/secondary buttons, the active segmented tab, and the resting composer.
- `shadow-elevated` covers popovers, menus, dialogs, drawers, and the welcome composer. It includes a 1px ring so overlays read crisply without a border.

## Shapes

| Radius | Use |
|---|---|
| `rounded-xs` 2px | xs buttons, checkboxes |
| `rounded-sm` 4px | **All CTAs** — buttons, icon buttons, send button, toggles, segmented-tab triggers, suggestion chips, Kbd keycaps |
| `rounded-md` 6px | Inputs, selects, textareas, menu/list/sidebar rows, segmented-control track |
| `rounded-xl` 10px | Cards, composer, message bubbles |
| `rounded-xxl` 12px | Overlays (`surface-overlay`): dialogs, popovers |
| `rounded-full` | Badges, avatars, status dots, progress tracks, switches |

## Components

- **Button** comes in `default` (indigo), `secondary` (tonal), `ghost` (transparent → `surface-hover`), `destructive`, `marketing` (ink fill), and `link` (`text-info`). All variants use `rounded-sm`. Sizes are `xs` 24 / `sm` 28 / `default` 32 / `lg` 36, plus square icon sizes at the same heights.
- **Input / Textarea / Select** are 32px tall (`h-8`), `rounded-md`, with a 1px `input` border. Focus darkens the border to `border-active` and adds a 3px indigo halo (`shadow-glow-subtle`). The 44px minimum is restored on coarse pointers.
- **Badge** is a 20px pill with 12px/500 text and a tonal fill. Variants: neutral, success, warning, danger, info, accent, outline.
- **Tabs** come in two forms. `default` is a segmented control: a 6px muted track with 4px triggers, where the active trigger is raised (`bg-background` + `shadow-xs`; `surface-hover` in dark). `line` is a 2px rounded indicator.
- **Menus** use 6px rows with `py-1.5`, `accent` (`surface-hover`) on focus, and muted 12px group labels.
- **Kbd** is a 20px keycap on `surface-hover` with `rounded-sm`.
- **Sidebar** uses `sidebar-bg` with 6px rows. Hover uses `sidebar-hover` and the active row uses `sidebar-active`, with no indicator bars or borders.

## Do's and Don'ts

**Do**
- Keep indigo scarce: one primary action per view.
- Keep CTAs sharp (`rounded-sm`); don't soften them back to 6px+ at call sites.
- Separate regions by fill and spacing.
- Use role utilities (`text-body-sm`, `text-heading-sm`, …) instead of ad-hoc sizes.
- Verify contrast with `npm run audit:wcag` after any token change.

**Don't**
- Don't use pill (`rounded-full`) buttons or rows.
- Don't add `border-b` / `border-r` dividers between regions, or a border on top of a tinted fill.
- Don't use uppercase tracked labels, gradients, glass/blur, or decorative shapes.
- Don't go below 12px or use 600/700 weights.
