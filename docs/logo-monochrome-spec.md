# Synapse Logo Monochrome Spec

## Purpose

Define a black-and-white logo system for Synapse that remains consistent across product UI, marketing pages, social assets, and print.

## Core Color Tokens

Use only these tokens for the primary logo system:

| Token | Hex | Usage |
|-------|-----|-------|
| `--logo-black` | `#0A0A0A` | Primary logo on light backgrounds |
| `--logo-white` | `#FFFFFF` | Inverse logo on dark backgrounds |
| `--logo-neutral-700` | `#2B2B2B` | Secondary/embossed variant only |
| `--logo-neutral-300` | `#D9D9D9` | Disabled or print support only |

Rules:
- Default to `--logo-black` and `--logo-white`.
- Do not introduce additional brand colors in monochrome lockups.
- Use grayscale tokens only for constrained contexts (print, disabled, watermark).

## Approved Lockups

Exactly two primary lockups are allowed:

1. **Dark on Light**
   - Logo fill: `--logo-black`
   - Background: white or near-white (`#FAFAFA` to `#FFFFFF`)

2. **Light on Dark**
   - Logo fill: `--logo-white`
   - Background: black or near-black (`#000000` to `#121212`)

Optional support lockup:
- **Neutral on Neutral** (print/embossed only): `--logo-neutral-700` on light textured surfaces.

## Contrast Requirements

- Normal logo usage must preserve strong figure/ground separation.
- Prefer maximum contrast for small-size marks.
- Minimum target contrast ratio: **4.5:1**.
- For favicon/app icon sizes under 24px, use pure black (`#000000`) when needed for optical clarity.

## Mark Geometry

The icon is a **split S** — the Synapse monogram broken at its spine:

- Two **neural terminals**: the upper and lower bowls of the S, drawn as round-capped arcs (r=19, stroke 13 on a 128 grid). The lower bowl is the upper rotated 180° about the center.
- A **synaptic cleft**: the S's diagonal spine is omitted, leaving a gap between the terminals.
- A **signal pulse**: a center dot (r=6) crossing the cleft. It is the only element that animates (`animated` prop).

The S keeps the mark legible as a letterform at 16px; the cleft-and-pulse keeps the synapse metaphor literal. Source of truth: `SplitSGlyph` in `web/src/shared/components/logo-variants.tsx`, mirrored in `web/public/favicon-{light,dark}.svg` and `logo.svg`. After editing the SVGs, run `uv run --with pillow python web/scripts/generate_favicons.py` to regenerate PNG/ICO/ICNS assets.

## Clear Space and Minimum Size

- Define `x` as the diameter of one neural terminal.
- Minimum clear space around all sides: `1x`.
- Do not place text, icons, or container borders inside clear space.
- Minimum digital size:
  - Icon-only mark: `16px`
  - Symbol + wordmark: `96px` width
- Minimum print size:
  - Icon-only mark: `5mm`
  - Symbol + wordmark: `25mm` width

## Background Control

- If background imagery is busy, add a solid container (white or black) before placing the logo.
- Avoid placing the logo directly on gradients or photographs without isolation.
- Keep corner radii of supporting containers simple and consistent (no decorative effects).

## Prohibited Usage (Misuse)

Do not:
- Apply gradients, glow, blur, shadows, or textures to the logo.
- Recolor monochrome lockups with non-token values.
- Stretch, skew, rotate, or alter logo proportions.
- Reduce opacity below 85% in primary brand contexts.
- Place dark logo on mid-dark backgrounds or white logo on mid-light backgrounds.
- Add outlines/strokes unless required by print production constraints.

## Implementation Tokens (CSS Example)

```css
:root {
  --logo-black: #0a0a0a;
  --logo-white: #ffffff;
  --logo-neutral-700: #2b2b2b;
  --logo-neutral-300: #d9d9d9;
}
```

## QA Checklist

- [ ] Correct lockup selected for the current background
- [ ] Token value matches approved palette
- [ ] Contrast target met
- [ ] Clear space preserved
- [ ] No effects (gradient/glow/shadow/blur)
- [ ] Minimum size respected
