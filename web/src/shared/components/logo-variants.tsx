import type { CSSProperties } from "react";

export type LogoVariant = "synaptic-s" | "diagonal" | "glyph" | "legacy";

export type LogoPalette = {
  background: string;
  glyph: string;
};

export type LogoTone = "auto" | "on-light" | "on-dark" | "neutral";

export function logoPaletteForTone(tone: LogoTone, variant?: LogoVariant): LogoPalette {
  const paletteByTone = {
    auto: {
      background: "var(--logo-bg, var(--logo-black, #0A0A0A))",
      glyph: "var(--logo-glyph, var(--logo-white, #FFFFFF))",
    },
    "on-light": {
      background: "var(--logo-black, #0A0A0A)",
      glyph: "var(--logo-white, #FFFFFF)",
    },
    "on-dark": {
      background: "var(--logo-white, #FFFFFF)",
      glyph: "var(--logo-black, #0A0A0A)",
    },
    neutral: {
      background: "var(--logo-neutral-700, #2B2B2B)",
      glyph: "var(--logo-white, #FFFFFF)",
    },
  } as const;

  const palette = paletteByTone[tone];

  if (variant === "glyph") {
    if (tone === "auto") {
      return {
        background: "var(--background, #FFFFFF)",
        glyph: "var(--foreground, var(--logo-black, #0A0A0A))",
      };
    }
    if (tone === "on-light") {
      return {
        background: "#FFFFFF",
        glyph: "var(--logo-black, #0A0A0A)",
      };
    }
    if (tone === "on-dark") {
      return {
        background: "#101114",
        glyph: "var(--logo-white, #FFFFFF)",
      };
    }
  }

  return palette;
}

type LogoGlyphProps = {
  palette: LogoPalette;
  animated?: boolean;
};

/** Current — S monogram with synaptic cleft at the inflection point. */
export function SynapticSGlyph({ palette, animated = false }: LogoGlyphProps) {
  return (
    <>
      <rect x="28" y="26" width="58" height="16" rx="8" fill={palette.glyph} opacity="0.96" />
      <rect x="70" y="34" width="16" height="28" rx="8" fill={palette.glyph} opacity="0.96" />
      <rect x="28" y="54" width="26" height="16" rx="8" fill={palette.glyph} opacity="0.96" />
      <rect x="74" y="54" width="26" height="16" rx="8" fill={palette.glyph} opacity="0.96" />
      <rect x="42" y="82" width="58" height="16" rx="8" fill={palette.glyph} opacity="0.96" />
      <rect x="42" y="66" width="16" height="28" rx="8" fill={palette.glyph} opacity="0.96" />
      <circle cx="92" cy="34" r="10" fill={palette.glyph} />
      <circle cx="36" cy="94" r="10" fill={palette.glyph} />
      <SynapticPulse cx={64} cy={62} palette={palette} animated={animated} />
    </>
  );
}

/** Primary mark — diagonal terminals with a cleft on the 45° axis. */
export function DiagonalSynapseGlyph({ palette, animated = false }: LogoGlyphProps) {
  return (
    <>
      <circle cx="40" cy="40" r="15" fill={palette.glyph} opacity="0.96" />
      <circle cx="88" cy="88" r="15" fill={palette.glyph} opacity="0.96" />
      <rect
        x="58"
        y="58"
        width="14"
        height="14"
        rx="2"
        transform="rotate(45 64 64)"
        fill={palette.background}
      />
      <rect
        x="50"
        y="50"
        width="12"
        height="8"
        rx="4"
        transform="rotate(45 54 54)"
        fill={palette.glyph}
        opacity="0.96"
      />
      <rect
        x="66"
        y="66"
        width="12"
        height="8"
        rx="4"
        transform="rotate(45 72 70)"
        fill={palette.glyph}
        opacity="0.96"
      />
      <SynapticPulse cx={64} cy={64} palette={palette} animated={animated} />
    </>
  );
}

/** Option B — glyph only; same synaptic S without the container square. */
export function GlyphOnlySynapticS({ palette, animated = false }: LogoGlyphProps) {
  return <SynapticSGlyph palette={palette} animated={animated} />;
}

/** Previous mark — circuit-board S with a corner node. */
export function LegacyCircuitGlyph({ palette }: LogoGlyphProps) {
  return (
    <>
      <rect x="26" y="24" width="76" height="18" rx="9" fill={palette.glyph} opacity="0.96" />
      <rect x="84" y="33" width="18" height="30" rx="9" fill={palette.glyph} opacity="0.96" />
      <rect x="26" y="54" width="76" height="18" rx="9" fill={palette.glyph} opacity="0.96" />
      <rect x="26" y="63" width="18" height="30" rx="9" fill={palette.glyph} opacity="0.96" />
      <rect x="26" y="86" width="76" height="18" rx="9" fill={palette.glyph} opacity="0.96" />
      <circle cx="95" cy="24" r="9" fill={palette.glyph} />
      <circle cx="95" cy="24" r="3.5" fill={palette.background} opacity="0.9" />
    </>
  );
}

function SynapticPulse({
  cx,
  cy,
  palette,
  animated = false,
}: {
  cx: number;
  cy: number;
  palette: LogoPalette;
  animated?: boolean;
}) {
  return (
    <>
      {animated ? (
        <circle
          cx={cx}
          cy={cy}
          r="9"
          fill={palette.glyph}
          opacity="0.2"
          className="origin-center animate-[logo-pulse-ring_1.8s_ease-in-out_infinite]"
          style={{ transformBox: "fill-box" } as CSSProperties}
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r="5"
        fill={palette.glyph}
        className={animated ? "animate-[logo-pulse-dot_1.8s_ease-in-out_infinite]" : undefined}
      />
    </>
  );
}

export function renderLogoGlyph(variant: LogoVariant, props: LogoGlyphProps) {
  switch (variant) {
    case "synaptic-s":
      return <SynapticSGlyph {...props} />;
    case "diagonal":
      return <DiagonalSynapseGlyph {...props} />;
    case "glyph":
      return <GlyphOnlySynapticS {...props} />;
    case "legacy":
      return <LegacyCircuitGlyph {...props} />;
  }
}

export const LOGO_VARIANT_META: Record<
  LogoVariant,
  { label: string; description: string; hasContainer: boolean }
> = {
  "synaptic-s": {
    label: "Synaptic S",
    description: "S monogram with a split middle rail and center signal pulse.",
    hasContainer: true,
  },
  diagonal: {
    label: "Diagonal synapse",
    description: "Two terminals on a 45° axis with a cleft and bridge pads.",
    hasContainer: true,
  },
  glyph: {
    label: "Glyph only",
    description: "Synaptic S without the rounded-square container.",
    hasContainer: false,
  },
  legacy: {
    label: "Legacy circuit S",
    description: "Previous rail-based S with a corner node.",
    hasContainer: true,
  },
};
