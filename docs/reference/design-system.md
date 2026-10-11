# Design system

Synapse's UI follows the Meta-inspired commerce/hardware-showcase system defined in [`/DESIGN.md`](../../DESIGN.md). Stark white canvas, cobalt commerce CTAs, pill buttons, 32-pt photographic cards, and a Montserrat type stack (substituting for the proprietary Optimistic VF).

Live token source: [`web/src/app/globals.css`](../../web/src/app/globals.css).
Authoritative spec: [`DESIGN.md`](../../DESIGN.md).
Live gallery: `/design-system` (dev-only route).

The file is structured as:
- `@theme` block — registers Tailwind v4 design tokens.
- `:root` — light-mode values.
- `.dark` — dark-mode overrides (synthesised; DESIGN.md does not publish dark tokens).

---

## Core principles

- **Cobalt is reserved for action.** `--color-cobalt` (`#0064e0`) belongs on Send / Run / Submit / Continue. Black `--color-ink-button` belongs on marketing/landing primaries.
- **Every interactive element is pill-shaped.** Buttons and badges use `--radius-full` (100px); icon-only buttons use `--radius-circle`. Squared corners signal "third-party widget" and should be filtered out.
- **Photography geometry is 32px.** `--radius-xxxl` is the minimum for photographic feature cards.
- **Flat by default.** Elevation is a commerce-flow signal, not a marketing flourish; only `card-checkout-summary` and `surface-overlay` (popovers/dialogs) carry a shadow.
- **Light, few lines.** Surfaces separate by tonal fill (`canvas` vs `surface-soft`/`muted`) and whitespace — not hairlines. Borders are reserved for form inputs (`Input`, `Textarea`, composer) and the explicit opt-in `Card variant="outlined"` / `Badge variant="outline"`. Don't add `border-b` section dividers or borders on top of a tinted fill.
- **Stylistic sets `ss01, ss02` always pair.** Headings activate both Optimistic VF stylistic sets. Montserrat lacks them — the declaration is harmless and future-proofs an Optimistic swap.

Legacy semantic aliases (`--color-background`, `--color-foreground`, `--color-primary`, …) are **kept** so the existing component layer continues to compile, but each one resolves to a DESIGN.md canonical token. New code should consume the canonical names directly.

---

## Colors

### Brand & accent

| Token | Light | Use |
|---|---|---|
| `--color-cobalt` | `#0064e0` | Commerce/action primary fill. Send / Run / Submit / Continue. |
| `--color-cobalt-deep` | `#0457cb` | Pressed-state and dark-surface variant. |
| `--color-cobalt-soft` | `#0091ff` | Translucent info callouts (`/15` alpha). |
| `--color-cobalt-selected` | `#0143b5` | Selected radio/checkbox border. |
| `--color-ink-button` | `#000000` | Marketing-surface primary pill fill. |
| `--color-fb-blue` | `#1876f2` | Focus rings, selected form controls. |
| `--color-meta-link` | `#385898` | Legacy navigation / footer link. |
| `--color-oculus-purple` | `#a121ce` | VR / category emphasis. |

### Surface

| Token | Light | Use |
|---|---|---|
| `--color-canvas` | `#ffffff` | Page background and primary card surface. |
| `--color-surface-soft` | `#f1f4f7` | Thumbnail / warranty background. Search-pill rest state. |
| `--color-hairline` | `#ced0d4` | 1px input border. |
| `--color-hairline-soft` | `#dee3e9` | Card / section dividers. |

### Text

| Token | Light | Use |
|---|---|---|
| `--color-ink-deep` | `#0a1317` | Primary headline + body text. |
| `--color-ink` | `#1c1e21` | Standard body text. |
| `--color-charcoal` | `#444950` | Tertiary body, form-button labels. |
| `--color-slate` | `#4b4c4f` | Section-header copy. |
| `--color-steel` | `#5d6c7b` | Caption text, footer link hierarchy. |
| `--color-stone` | `#8595a4` | Disabled / de-emphasised labels. |
| `--color-disabled-text` | `#bcc0c4` | Disabled-button text fill. |

### Semantic

| Token | Light | Use |
|---|---|---|
| `--color-success` | `#31a24c` | "In stock", "Verified". |
| `--color-attention` | `#f2a918` | Mid-priority alerts. |
| `--color-warning` | `#f7b928` | Promo banners, limited-time tags. |
| `--color-critical` | `#e41e3f` | Validation errors. |
| `--color-critical-strong` | `#f0284a` | Form-input error border. |

---

## Typography

**Font stack.** `--font-sans` chains `var(--font-montserrat) → Noto Sans CJK → system fallbacks`. DESIGN.md targets Optimistic VF; Montserrat is the first declared fallback and the closest humanist-geometric match. Code blocks keep Geist Mono via `--font-mono`.

### Roles

Each role is exposed as a `text-*` utility (e.g. `<h1 className="text-hero-display">`):

| Utility | Size | Weight | LH | Letter-spacing |
|---|---|---|---|---|
| `text-hero-display` | 64px | 500 | 1.16 | 0 |
| `text-display-lg` | 48px | 500 | 1.17 | 0 |
| `text-heading-lg` | 36px | 500 | 1.28 | 0 |
| `text-heading-md` | 28px | **300** | 1.21 | 0 |
| `text-heading-sm` | 24px | 500 | 1.25 | 0 |
| `text-subtitle-lg` | 18px | 700 | 1.44 | 0 |
| `text-subtitle-md` | 18px | 400 | 1.44 | 0 |
| `text-body-md` | 16px | 400 | 1.50 | -0.16px |
| `text-body-md-bold` | 16px | 700 | 1.50 | -0.16px |
| `text-body-sm` | 14px | 400 | 1.43 | -0.14px |
| `text-body-sm-bold` | 14px | 700 | 1.43 | -0.14px |
| `text-caption-bold` | 12px | 700 | 1.33 | 0 |
| `text-button-md` | 14px | 700 | 1.43 | -0.14px |
| `text-link-md` | 16px | 700 | 1.50 | -0.16px |

The 300-weight `text-heading-md` is the system's signature editorial subhead — it creates visual rest between 500-weight displays and 400-weight body.

**Weights.** Only 300 / 400 / 500 / 700 are on-scale. Don't use `font-semibold` (600) or arbitrary weights; reach for the role utility instead.

**12px floor.** Nothing renders below 12px. The legacy `text-micro` and `text-caption` utilities both resolve to 12px; `status-pill` / `chip-*` metadata inherit the same floor.

---

## Radius scale

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 2px | Inline checkbox marks. |
| `--radius-sm` | 4px | Tags, micro-controls. |
| `--radius-md` | 6px | Square thumbnails. |
| `--radius-lg` | 8px | Form inputs, radio cards. |
| `--radius-xl` | 16px | Icon-feature cards, FAQ items. |
| `--radius-xxl` | 24px | Warranty / accessory tiles. |
| `--radius-xxxl` | 32px | Photographic feature cards, promo strips. |
| `--radius-feature` | 40px | Accessory hero panels. |
| `--radius-full` | 100px | **All** pill buttons, tab chips, badges. |
| `--radius-circle` | 9999px | Color swatches, icon buttons. |

---

## Spacing scale

`@theme` registers the DESIGN.md spacing rhythm as `--spacing-*` tokens. The base unit is 4px; the dominant primary step is 8px (`--spacing-xs`).

| Token | Value | Use |
|---|---|---|
| `xxs` | 4 | Hairline rhythm. |
| `xs` | 8 | Primary step. |
| `sm`/`md`/`base` | 10 / 12 / 16 | Inline padding. |
| `lg`/`xl` | 20 / 24 | Card internals. |
| `xxl`/`xxxl` | 32 / 40 | Card padding default. |
| `section-sm`/`section` | 48 / 64 | Section rhythm. |
| `section-lg`/`hero` | 80 / 120 | Marketing rhythm. |

---

## Components

Pull from `@/shared/components/ui`. The dev-only `/design-system` route (`web/src/app/design-system/page.tsx`) renders every variant below exactly as it ships — keep it in sync when a variant is added or removed.

### Buttons (`Button`)

| Variant | Use |
|---|---|
| `default` | Cobalt commerce primary. Send/Run/Submit/Connect. |
| `marketing` | Black ink pill (inverts to white in dark mode). Landing/login CTAs. |
| `secondary` | Borderless `surface-soft` tonal fill; hover deepens the fill. |
| `ghost` | Transparent; `muted` fill on hover. Tertiary / icon actions. |
| `destructive` | `critical` fill with `on-destructive` text (AA in both themes). Use the variant — never hand-roll `bg-destructive text-white`. For `AlertDialogAction`, pass `variant="destructive"`. |
| `link` | Inline cobalt text link. |
| Sizes | `xs / sm / default / lg / tab` (pill, `text-button-md`) and `icon / icon-xs / icon-sm / icon-lg` (`rounded-circle`). |

All variants are pill-shaped (`rounded-full`) — don't override with `rounded-md` / `rounded-lg` at call sites.

### Cards (`Card`, `variant="…"`)

| Variant | Chrome |
|---|---|
| `default` | `card` fill, 16px radius (`rounded-xl`), borderless — separated from the page by tone. |
| `sunken` | `muted` fill, 16px radius, borderless. Secondary content blocks. |
| `interactive` | `card` fill, 16px radius; gains `shadow-elevated` on hover. |
| `outlined` | Opt-in 1px `border` — only when a card sits on a same-tone surface (e.g. inside a white dialog). |
| `panel` | Legacy alias of `default` (8px radius) for existing call sites. |

**Surface utilities** (all borderless):

| Utility | Chrome |
|---|---|
| `surface-panel` | `surface-soft` fill, 16px radius. |
| `surface-overlay` | `popover` fill, 24px radius, `shadow-elevated` — no border. |
| `card-product-feature` / `card-icon-feature` / `card-why-buy-tile` | `surface-soft` tonal fill, 32 / 16 / 16px radius, no border. |
| `card-checkout-summary` | Canvas fill, 16px radius, `shadow-sticky-rail` (the one elevated card). |
| `card-feature-photo` / `card-promo-strip` / `card-warranty` | Image-fill / ink-deep / surface-soft photographic tiles. |
| `chip-muted`, `status-*` | Pill, tonal fill only, 12px sans. Prefer `<Badge>` in new code. |

### Inputs (`Input`)

44px tall, `--radius-lg`, 1px `--color-hairline`. Focus switches to a 2px `--color-fb-blue` border. Error state uses `--color-critical-strong`.

### Badges (`Badge`)

All pill, caption-bold (12px/700), tonal fill (no border). Variants: `neutral` (default), `success`, `warning`, `danger`, `info`, `accent`, and opt-in bordered `outline`. Success/warning text uses the AA `success-text` / `warning-text` tokens; use those (not `text-success` / `text-warning`) whenever those hues are used as text or icon colour.

### Tabs (`Tabs`, `TabsList variant="…"`)

`default` — segmented control; the active trigger gets a `card` fill. `line` — transparent, active trigger shows an underline indicator.

### Signature components

The DESIGN.md marketing set (`PromoBanner`, `HeroBand`, `FeatureIconRow`, `FooterRegion`, `ColorSwatch`) is **not currently shipped** — the `/design-system` gallery sections for them are commented out pending a rebuild.

---

## Do's and Don'ts

### Do

- Reserve `--color-cobalt` for action CTAs — its weight is meaningful precisely because it's scarce.
- Use `Button variant="marketing"` (ink) for marketing-surface primaries. Pair with `secondary`.
- Apply `rounded-full` to every button and badge (it's built into the primitives).
- Separate surfaces with tonal fill and spacing; keep borders for inputs and explicit `outlined` variants.
- Apply `--radius-xxxl` to photographic product cards and `--radius-xl` to icon-feature tiles.
- Switch on `ss01, ss02` together — never one without the other.
- Use the 300-weight `text-heading-md` for editorial subheads.

### Don't

- Don't use cobalt for marketing-surface primaries — that's the black pill's job.
- Don't introduce accent colors beyond cobalt + Oculus purple.
- Don't soften pill buttons below `rounded-full`.
- Don't run feature cards without rounding — `rounded-xxxl` is the minimum for photographic surfaces.
- Don't reduce `text-body-md` line-height below 1.50.
- Don't apply heavy shadows to marketing cards — elevation is a commerce-flow signal.
- Don't add hairline dividers (`border-b`, `border-r`) between sections, or a border on top of a tinted fill.
- Don't go below 12px type or use 600 weight.

---

## Responsive contract

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile (sm) | `<480px` | Hero drops to `text-display-lg`; pill-tab nav collapses; PDP rail → sticky bottom bar. |
| Mobile (lg) | `480–767px` | Feature tiles 2-up. |
| Tablet | `768–1023px` | Pill-tab nav returns; PDP at 60/40. |
| Desktop | `1024–1359px` | Full 3/4-up grids; PDP 58/42. |
| Wide | `≥1360px` | Wider gutters, larger product photography. |

Touch targets: 44px for primary buttons and inputs; 40×40 for icon-circular buttons (44 on mobile via the existing `[data-slot=button]` override).

---

## Known gaps

- DESIGN.md does not define dark-mode token values — current `.dark` set is synthesised to keep cobalt readable.
- Optimistic VF stylistic sets (`ss01`, `ss02`) are not present in Montserrat; the declaration is kept and harmless.
- Pastel decorative tints inside accessory cards are not formalized as tokens — treat them as photographic content.
- Animation/transition timings are not extracted from spec — current defaults: 150ms ease-out for surfaces, 300ms ease-in-out for accordions.
