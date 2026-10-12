# Synapse Frontend Design Guide

This is the canonical product UI style guide for Synapse. The visual system is **Linear-inspired**: a quiet, light canvas, Inter Variable at a compact 13px UI base, a single indigo brand fill (`#5e6ad2`), 6px controls, 10px cards, and surfaces separated by tonal fill and spacing rather than borders. The system spec lives in [`/DESIGN.md`](../DESIGN.md); token tables live in [`docs/reference/design-system.md`](reference/design-system.md).

## 1) Scope and Precedence

### Scope
- Applies to all product UI in `web/src/**`: app shell, conversation, agent-computer, skills, MCP, channels, login, design-system gallery, and shared primitives.
- Login and other landing-style surfaces use the same system; there is no separate "marketing" track.

### Canonical precedence
1. [`/DESIGN.md`](../DESIGN.md): system spec (colors, type roles, radii, component definitions)
2. `web/src/app/globals.css`: live token values and `@utility` contracts (source of truth for values)
3. This `design.md`: rules, do/don't, and usage guidance
4. [`docs/reference/design-system.md`](reference/design-system.md): reference shard of tokens and components
5. Audit reports / archived guides

If guidance conflicts, follow this order.

## 2) Design Principles

- **Light and quiet.** The UI should feel airy. Content carries the surface; chrome stays restrained.
- **Minimal borders and dividers.** Separate surfaces with tonal fill (`canvas` vs `surface-soft` vs `surface-hover`) and spacing, not hairlines. Reach for a border only when two surfaces share the same tone (e.g. an outlined card inside a white dialog).
- **Indigo is the only brand fill.** `--color-indigo` (`#5e6ad2`) belongs on the primary action (Send / Run / Submit / Continue), selection, and focus. Everything else is neutral.
- **Sharp, precise geometry.** Every CTA — buttons, icon buttons, toggles, segmented-tab triggers, suggestion chips — is 4px (`rounded-sm`; `xs` buttons 2px). Inputs, menu items, and sidebar rows are 6px (`rounded-md`); cards are 10px; overlays are 12px. Only badges and avatars are fully round.
- **Token-first, role-first.** Use canonical color tokens (`bg-canvas`, `text-ink-deep`) and typography role utilities (`text-heading-lg`, `text-body-sm`). Avoid raw hex and raw `text-[13px] font-medium leading-[1.43]` chains where a role exists.
- **Flat by default.** Cards carry no shadow; `shadow-xs` gives controls a hint of lift; `shadow-elevated` is reserved for floating overlays.
- **Accessibility-first.** Keyboard-visible indigo focus, AA contrast in both themes, reduced-motion respect, CJK-safe layouts.

## 3) Foundations

### 3.1 Token architecture

Token contract lives in `web/src/app/globals.css`:
- `@theme`: registers Tailwind v4 token names (auto-generates `bg-X / text-X / border-X / ring-X` utilities)
- `:root`: light-mode runtime values
- `.dark`: dark-mode runtime overrides (Linear near-black ramp)

Every token change must be mirrored in all three blocks.

### 3.2 Color token groups

- **Brand / action**: `indigo`, `indigo-deep` (hover), `indigo-soft`, `indigo-selected` (active), `indigo-text` (indigo used as text/links), `on-indigo`; `ink-button` / `on-ink-button` for the ink-filled `marketing` button
- **Surface**: `canvas`, `surface-soft`, `surface-hover`
- **Text**: `ink-deep`, `ink`, `charcoal`, `slate`, `steel`, `stone`, `disabled-text`
- **Hairline** (use sparingly): `hairline`, `hairline-soft`
- **Accent**: `violet` (secondary accent, e.g. AI/agent highlights). Focus uses `--color-focus`, which resolves to indigo.
- **Semantic**: `success`, `attention`, `warning`, `critical`, `critical-strong`, plus foreground-safe `success-text` / `warning-text` and `*-subtle` tints
- **Product-specific**: `sidebar-*`, `terminal-*`, `profile-ring*`, `ai-*` (resolve to canonical tokens via aliasing or `color-mix`)
- **Legacy aliases**: `background`, `foreground`, `primary`, `secondary`, `muted`, `border`, `input`, `ring`, `destructive`, `accent`, `card`, `popover`. Kept so existing component classes compile; each remaps to a canonical token. New code should consume canonical names directly.

### 3.3 Radius contract

| Token | Value | Use |
|---|---|---|
| `rounded-xs` | 2px | `xs` and `icon-xs` buttons, checkbox marks, inline chip controls. |
| `rounded-sm` | 4px | **All CTAs: buttons, icon buttons, send button, toggles, segmented-tab triggers, suggestion chips, Kbd.** |
| `rounded-md` | 6px | **Inputs, selects, menu items, sidebar rows, segmented track, search trigger.** |
| `rounded-lg` | 8px | Code blocks, thumbnails, dense panels. |
| `rounded-xl` | 10px | **Cards** (`Card` default / sunken / interactive / outlined), `surface-panel`. |
| `rounded-xxl` | 12px | **Overlays** (`surface-overlay`: dialogs, popovers, menus, hover cards). |
| `rounded-xxxl` | 16px | Large feature panels (rare). |
| `rounded-feature` | 20px | Hero / feature showcase panels (rare). |
| `rounded-full` | 9999px | **Badges and avatars only.** Not buttons. |

Icon buttons are sharp 4px squares, not circles.

### 3.4 Focus contract

Default interactive focus pattern:
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background`

`--color-focus` (and therefore `ring`) resolves to `--color-indigo`. Text inputs keep their 1px hairline at rest; on focus the border steps up to `border-active` and a soft 3px indigo halo (`shadow-glow-subtle`) appears, with no layout shift.

Use `ring-1` only inside dense product chrome where a thinner ring is intentional.

### 3.5 Typography contract

- **Sans stack** (`--font-sans`): **Inter Variable**, bundled via `next/font/local` as `--font-inter` (`web/src/app/fonts.ts`), then the native system stack and `--font-cjk-sans` for CJK. Inter features `"cv01", "ss03"` are always on (body and headings).
- **Weights**: 400 (regular), 510 (medium: UI labels, buttons), 590 (semibold: headings), 680 (bold, rare).
- **Sizes**: UI base is **13px** (`text-body-sm`, buttons, inputs); reading copy is **15px** (`text-body-md`, chat/markdown). 12px (`text-caption-bold`, `text-micro`) is the floor.
- **Mono stack** (`--font-mono`): Geist Mono, then system mono. Reserved for code blocks and tabular numerics.

#### Type roles

Every role is exposed as a single `@utility` class. Use these instead of raw size/weight/tracking chains:

| Utility | Size | Weight | LH | Tracking |
|---|---|---|---|---|
| `text-hero-display` | clamp(40px, 5vw, 64px) | 510 | 1.06 | -0.032em |
| `text-display-lg` | clamp(32px, 4vw, 48px) | 510 | 1.1 | -0.028em |
| `text-heading-lg` | 28px | 590 | 1.2 | -0.022em |
| `text-heading-md` | 24px | 590 | 1.3 | -0.018em |
| `text-heading-sm` | 20px | 590 | 1.33 | -0.012em |
| `text-subtitle-lg` | 17px | 590 | 1.45 | -0.008em |
| `text-subtitle-md` | 17px | 400 | 1.6 | -0.006em |
| `text-body-md` | 15px | 400 | 1.6 | -0.004em |
| `text-body-md-bold` | 15px | 590 | 1.6 | -0.004em |
| `text-body-sm` | 13px | 400 | 1.5 | 0 |
| `text-body-sm-bold` | 13px | 510 | 1.5 | 0 |
| `text-caption-bold` | 12px | 510 | 1.33 | 0 |
| `text-button-md` | 13px | 510 | 1.43 | 0 |
| `text-link-md` | 13px | 510 | 1.43 | 0 |

Values above mirror `globals.css`; if they drift, `globals.css` wins. `:lang(zh)` relaxes tracking and opens line-height for CJK.

Section eyebrows use the `label-section` utility (sentence case, 12px / 510 Inter, no tracking). The old uppercase mono `label-mono` label is gone.

Bare `<h1>`–`<h6>` tags inherit `cv01, ss03`, weight 590 (510 for h4–h6), and tight tracking, but **deliberately have no tag-level `font-size`**. Pick a role utility per element.

### 3.6 Spacing contract

4px-based scale with named steps: `xxs 4 / xs 8 / sm 10 / md 12 / base 16 / lg 20 / xl 24 / xxl 32 / xxxl 40 / section-sm 48 / section 64 / section-lg 80 / hero 120`. Spacing, not dividers, is the primary way to group and separate content. Prefer a larger gap over adding a rule.

### 3.7 Elevation contract

| Token | Use |
|---|---|
| `--shadow-card` (none) | Cards are flat; tonal fill does the separating. |
| `--shadow-xs` | Faint lift on filled controls (primary/secondary buttons, active segmented tab). |
| `--shadow-elevated` | Floating overlays (`surface-overlay`) and `Card variant="interactive"` on hover. |
| `--shadow-sticky-rail` | Sticky action bars only. |

Do not add diffuse atmosphere shadows to cards.

### 3.8 Dark theme

Dark mode uses Linear's near-black ramp: canvas `#0f1011`, sidebar `#090a0b`, surface `#17181a`, surface-hover `#202124`. Indigo stays `#5e6ad2` as a fill; `indigo-text` lifts to `#828fff` for legibility. The `marketing` ink button inverts (light fill on dark). Validate indigo and critical contrast when adding new dark surfaces.

### 3.9 CJK safety

Chinese (`zh-CN`) typography:
- Inter covers Latin only; CJK glyphs fall through to the native CJK stack. Latin display tracking is relaxed for CJK via `:lang(zh)`.
- **Layout rule**: centered CJK copy must use **block flow + `text-align: center`** (`cjk-safe-centered` / `cjk-safe-centered-constrained` utilities). Do **not** use `flex items-center` or `grid justify-items: center` on the text container; both shrink cross-axis size to min-content (~1 glyph for CJK), causing vertical text. In horizontal rows, **`flex-1 min-w-0` and `grid-cols-[minmax(0,1fr)_…]` also collapse CJK**, because the `minmax(0, …)` / `min-w-0` minimum allows tracks to shrink below glyph width. Use plain `1fr` columns, or flex rows **without** `min-w-0` on the label (push trailing icons with `ml-auto`).

## 4) Usage Rules (Do / Don't)

### Do
- Use canonical color shortnames (`bg-canvas`, `bg-surface-soft`, `text-ink-deep`).
- Use typography role utilities (`text-heading-lg`, `text-body-sm`) and `label-section` for eyebrows.
- Separate regions with tonal fill and spacing. A sidebar on `surface-soft` next to a `canvas` main area needs no divider.
- Use `Card` variants: `default` / `sunken` (borderless, 10px), `interactive` (lifts on hover), `outlined` only for same-tone surfaces.
- Reuse `Button` variants: `default` (indigo) for the primary action, `secondary` (tonal) for secondary actions, `ghost` for toolbar/tertiary, `destructive` for irreversible actions, `marketing` (ink fill) for login/landing CTAs, `link` (indigo text) for inline links.
- Use the `search-pill` utility (6px, `surface-soft`, 32px tall) for nav-level search triggers.
- Mirror every token change in `@theme`, `:root`, and `.dark`.
- Use `cjk-safe-centered` / `cjk-safe-centered-constrained` for centered CJK copy.

### Don't
- Don't use indigo fills for anything but the primary action, selection, and focus. One indigo button per view is the norm.
- Don't make buttons pill-shaped (`rounded-full`) or icon buttons circular. Use `rounded-sm`.
- Don't add borders or `divide-*` rules to separate sections that already differ in tone or are separated by spacing.
- Don't introduce new accent colors beyond indigo and violet.
- Don't write raw `text-[13px] font-medium leading-[1.43]` chains where `text-button-md` / `text-body-sm-bold` already encodes the role.
- Don't write `bg-[color:var(--color-X)]`. Tailwind v4 auto-generates `bg-X` from `@theme`; use the shortname.
- Don't apply shadows to cards at rest.
- Don't reintroduce `backdrop-blur`, `glass-surface`, `gradient-heading`, or diffuse atmosphere layers.
- Don't set `font-size` on bare `<h1>`–`<h6>` selectors. Opt in via role utilities per element.

## 5) Surfaces and Overlay Conventions

### Surface types
- **Default card**: `Card variant="default"`. 10px radius, `bg-card`, no border, no shadow.
- **Sunken card**: `Card variant="sunken"`. 10px radius, `bg-muted` (`surface-soft`). For secondary content blocks on canvas.
- **Interactive card**: `Card variant="interactive"`. Borderless; gains `shadow-elevated` on hover.
- **Outlined card**: `Card variant="outlined"`. Opt-in `border-border`; only when the card sits on a same-tone surface.
- **Panel**: `surface-panel` utility (10px radius, `surface-soft`) for in-app grouping without a `Card`.

### Overlay contract
- Dialogs, popovers, menus, and hover cards use `surface-overlay` chrome: 12px radius, `bg-popover`, `shadow-elevated` (the shadow carries a 1px ring, so no separate border).
- Menu items inside overlays use `rounded-md` with `surface-hover` for the highlighted row.

## 6) Component and Layout Conventions

### 6.1 Shared primitive layer

Authoritative implementations:
- `web/src/shared/components/ui/button.tsx`: sharp 4px buttons (`xs` 2px); sizes `default` (h-8), `sm` (h-7), `xs` (h-6), `lg` (h-9), `tab`; icon sizes `icon` (size-8), `icon-sm`, `icon-xs`, `icon-lg`
- `web/src/shared/components/ui/card.tsx`: `default`, `sunken`, `interactive`, `outlined`, `panel`
- `web/src/shared/components/ui/input.tsx`: h-8, 6px, 1px hairline, indigo halo on focus
- `web/src/shared/components/ui/badge.tsx`: compact `rounded-full` badges (`neutral`, `success`, `warning`, `danger`, `info`, `accent`, `outline`)
- `web/src/shared/components/ui/tabs.tsx`: `default` segmented tabs (tonal track, raised active trigger) and `line` tabs
- `web/src/shared/components/ui/dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `popover.tsx`, `hover-card.tsx`: overlay chrome
- `web/src/shared/components/ui/tooltip.tsx`

### 6.2 App shell

- Sidebar: `web/src/shared/components/Sidebar.tsx`. `bg-sidebar-bg` (light: `surface-soft`; dark: `#090a0b`) with `bg-sidebar-active` / `bg-sidebar-hover` tonal rows at `rounded-md`. No divider against the main canvas.
- Top bar: `web/src/shared/components/TopBar.tsx`. Canvas background; avoid a bottom border unless content scrolls under it. The search trigger uses `search-pill`.

### 6.3 Conversation and input surfaces

Reference implementations:
- `web/src/features/conversation/components/HomeScreen.tsx`: `cjk-safe-centered` headline + `cjk-safe-centered-constrained` subtitle, sharp 4px suggestion chips.
- `web/src/features/conversation/components/ConversationWorkspace.tsx`
- `web/src/features/conversation/components/ChatInput.tsx`
- `web/src/shared/components/SearchInput.tsx`

Rule: raw HTML controls (`input`, `textarea`, `button`) used directly must still follow token, radius, focus, and accessibility contracts.

### 6.4 Live gallery

The dev-only `/design-system` route (`web/src/app/design-system/page.tsx`) renders the token + primitive gallery from live tokens, including a light/dark spot-check. Use it as the visual regression surface when token values change.

## 7) Status and Feedback Patterns

- Status chips use `Badge` (`rounded-full`, `text-caption-bold`, tinted `*-subtle` fill, no border):
  - `neutral` (default): "Beta", counts
  - `success`: "Connected", "Done"
  - `warning`: "Needs attention"
  - `danger`: errors, validation labels
  - `info` / `accent`: "Syncing", in-progress, highlights
  - `outline`: only when a tinted fill would clash with the surface
- Legacy `status-pill` + `status-*` utilities remain for dense product surfaces; prefer `Badge` for new code.
- Loading: skeleton shimmer over spinners for content surfaces; spinners stay reserved for momentary action states (button submit, inline retry).

## 8) Accessibility and Interaction Standards

- Semantic controls (`button`, `a`, form elements) over clickable wrappers.
- Touch targets: controls are compact on fine pointers (h-8 default); the global coarse-pointer override in `globals.css` raises hit areas on touch devices. Icon-only buttons need an `aria-label`.
- Focus: indigo `ring-2` with offset on canvas; inputs use the border + halo treatment (§3.4).
- Contrast: body text AA in both themes; use `success-text` / `warning-text` for status text rather than the fill tokens. `web/scripts/check-wcag-contrast.mjs` checks token pairs.
- Reduced motion: respect `prefers-reduced-motion` and Framer Motion's `useReducedMotion`. Default transitions are short (100–150ms ease-out).
- CJK: see §3.9.

## 9) Exception Policy

Narrow, explicit exceptions only:

1. **Provider brand identity UI** may use official provider colors for recognition.
   - Reference: `web/src/features/channels/components/ChannelProviderIcon.tsx`.
2. **Isolated embedded previews** (iframe content, sandboxed renders) may use local fallback colors when app CSS vars are unavailable.

Exceptions must not be reused as general product-semantic colors.

## 10) Implementation Drift and Migration Notes

1. **Legacy aliases** (`primary`, `muted`, `accent-*`, `info`, etc.) remain and resolve to Linear tokens. Prefer canonical names in new code; migrate opportunistically.
2. **Legacy dense utilities** (`status-pill`, `chip-muted`) remain for unmigrated surfaces; prefer `Badge` for new code.
3. **Residual borders**: some feature surfaces still carry hairline borders or dividers from the previous system. Remove them when touching those files if tonal fill or spacing already separates the content.
4. **Animation timings** are not yet a formal token contract. Current defaults: 100ms ease-out for control state changes, 150ms for surface transitions.

## 11) Governance and Update Workflow

When changing design tokens or visual standards:

1. Update [`/DESIGN.md`](../DESIGN.md) if the **spec** changes (new color role, new component, new radius tier).
2. Update token values in `web/src/app/globals.css` (`@theme`, `:root`, `.dark`); keep parity across all three blocks.
3. Update this `design.md` for rule/contract changes (not for every value tweak).
4. Update [`docs/reference/design-system.md`](reference/design-system.md) for token table changes.
5. Validate impacted shared primitives and the `/design-system` gallery; spot-check both light and dark themes.
6. From `web/`, run `npm run typecheck`, `npm run lint`, and `npm test`; refresh affected snapshots only after visually reviewing the diff.

## 12) Canonical Reference Map

### Spec + tokens
- [`/DESIGN.md`](../DESIGN.md): canonical Linear-inspired spec
- [`docs/reference/design-system.md`](reference/design-system.md): token tables
- `web/src/app/globals.css`: live tokens, role utilities, `surface-overlay`, `surface-panel`, `search-pill`, `label-section`
- `web/src/app/fonts.ts`: Inter Variable and Geist Mono loaders

### Shared shell / components
- `web/src/shared/components/Sidebar.tsx`
- `web/src/shared/components/TopBar.tsx`
- `web/src/shared/components/SearchInput.tsx`
- `web/src/shared/components/CommandPalette.tsx`

### Shared UI primitives
- `web/src/shared/components/ui/button.tsx`
- `web/src/shared/components/ui/card.tsx`
- `web/src/shared/components/ui/input.tsx`
- `web/src/shared/components/ui/badge.tsx`
- `web/src/shared/components/ui/tabs.tsx`
- `web/src/shared/components/ui/dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `popover.tsx`, `hover-card.tsx`

### Feature exemplars
- `web/src/app/design-system/page.tsx`: live gallery (dev-only)
- `web/src/features/conversation/components/HomeScreen.tsx`: CJK-safe centered hero (`cjk-safe-centered*`) + suggestion chips
- `web/src/features/conversation/components/ConversationWorkspace.tsx`
- `web/src/features/conversation/components/ChatInput.tsx`
- `web/src/features/agent-computer/components/AgentProgressCard.tsx`
- `web/src/features/agent-computer/components/ArtifactFilesPanel.tsx`
- `web/src/features/skills/components/SkillsPage.tsx`
- `web/src/features/mcp/components/MCPPage.tsx`
- `web/src/features/channels/components/ChannelPageHeader.tsx`
- `web/src/features/channels/components/ChannelProviderIcon.tsx`
