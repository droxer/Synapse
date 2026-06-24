import { cn } from "@/shared/lib/utils";
import {
  LOGO_VARIANT_META,
  logoPaletteForTone,
  renderLogoGlyph,
  type LogoTone,
  type LogoVariant,
} from "@/shared/components/logo-variants";

export type { LogoTone, LogoVariant };

interface LogoProps {
  size?: number;
  className?: string;
  /**
   * Select logo lockup based on surrounding surface.
   * - auto: follows theme tokens (`--logo-bg` / `--logo-glyph`)
   * - on-light: black container + white glyph
   * - on-dark: white container + black glyph
   * - neutral: dark-neutral container + white glyph
   */
  tone?: LogoTone;
  /** Logo mark geometry. Defaults to the diagonal synapse lockup. */
  variant?: LogoVariant;
  /** Pulse the synaptic cleft dot (Option C). */
  animated?: boolean;
}

/**
 * Synapse product logo in strict monochrome lockups.
 */
export function Logo({
  size = 28,
  className,
  tone = "auto",
  variant = "diagonal",
  animated = false,
}: LogoProps) {
  const palette = logoPaletteForTone(tone, variant);
  const meta = LOGO_VARIANT_META[variant];
  const showContainer = meta.hasContainer;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {showContainer ? <rect width="128" height="128" rx="28" fill={palette.background} /> : null}
      {renderLogoGlyph(variant, { palette, animated })}
    </svg>
  );
}

/**
 * Favicon-friendly standalone version (for generating static assets).
 */
export function LogoMark({ size = 48, className, variant, animated }: LogoProps) {
  return (
    <Logo
      size={size}
      className={className}
      variant={variant}
      animated={animated}
    />
  );
}
