"use client";

import { Logo } from "@/shared/components/Logo";
import { type LogoVariant } from "@/shared/components/logo-variants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";

const PREVIEW_SIZES = [16, 28, 56] as const;

const VARIANTS: Array<{
  id: LogoVariant | "synaptic-s-animated" | "split-s-animated";
  variant: LogoVariant;
  animated?: boolean;
  badge?: string;
}> = [
  { id: "split-s", variant: "split-s", badge: "Current" },
  { id: "split-s-animated", variant: "split-s", animated: true, badge: "Loading" },
  { id: "diagonal", variant: "diagonal", badge: "Previous" },
  { id: "synaptic-s", variant: "synaptic-s" },
  { id: "synaptic-s-animated", variant: "synaptic-s", animated: true, badge: "Option C" },
  { id: "glyph", variant: "glyph", badge: "Option B" },
  { id: "legacy", variant: "legacy", badge: "Legacy" },
];

const VARIANT_COPY: Record<
  (typeof VARIANTS)[number]["id"],
  { title: string; note: string }
> = {
  "split-s": {
    title: "Split S",
    note: "Primary mark, in-app and for favicons and app icons. An S broken at its spine — the gap is the synaptic cleft, the dot the signal crossing it.",
  },
  "split-s-animated": {
    title: "Split S + pulse",
    note: "Loading screen only. The signal dot pulses across the cleft; static under reduced motion.",
  },
  diagonal: {
    title: "Diagonal synapse",
    note: "Previous mark. Two terminals on a 45° axis; read as a dumbbell at small sizes.",
  },
  "synaptic-s": {
    title: "Synaptic S",
    note: "Alternate S monogram with split middle rail and center pulse.",
  },
  "synaptic-s-animated": {
    title: "Synaptic S + pulse",
    note: "Animated cleft-dot pulse for loading and agent-active states.",
  },
  glyph: {
    title: "Glyph only",
    note: "Cleaner beside the wordmark in the sidebar; needs a surface behind it.",
  },
  legacy: {
    title: "Legacy circuit S",
    note: "Previous mark for reference. Simpler at 16px, weaker synapse metaphor.",
  },
};

function PreviewSurface({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption-bold text-muted-foreground">{label}</span>
      <div className={cn("flex h-24 items-center justify-center rounded-xl", className)}>
        {children}
      </div>
    </div>
  );
}

function VariantCard({
  id,
  variant,
  animated = false,
  badge,
}: (typeof VARIANTS)[number]) {
  const copy = VARIANT_COPY[id];

  return (
    <article className="surface-panel flex flex-col gap-5 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-subtitle-lg text-balance">{copy.title}</h3>
            {badge ? (
              <Badge>{badge}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-body-sm text-muted-foreground">{copy.note}</p>
        </div>
        <Logo size={56} variant={variant} tone="auto" animated={animated} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PREVIEW_SIZES.map((size) => (
          <div key={size} className="flex flex-col items-center gap-2 rounded-xl bg-background px-3 py-4">
            <Logo
              size={size}
              variant={variant}
              tone="auto"
              animated={animated}
              className={size === 56 ? "rounded-lg" : undefined}
            />
            <span className="text-caption-bold text-muted-foreground tabular-nums">{size}px</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <PreviewSurface label="Theme auto" className="bg-background">
          <Logo size={40} variant={variant} tone="auto" animated={animated} />
        </PreviewSurface>
        <PreviewSurface label="On light" className="bg-[var(--logo-white)]">
          <Logo size={40} variant={variant} tone="on-light" animated={animated} />
        </PreviewSurface>
        <PreviewSurface label="On dark" className="bg-[var(--logo-black)]">
          <Logo size={40} variant={variant} tone="on-dark" animated={animated} />
        </PreviewSurface>
      </div>

      <div className="rounded-xl bg-background px-4 py-3">
        <p className="text-body-sm-bold">Sidebar lockup preview</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-sidebar-bg px-4 py-3">
          <Logo
            size={28}
            variant={variant}
            tone="auto"
            animated={animated}
          />
          <span className="brand-wordmark">Synapse</span>
        </div>
      </div>
    </article>
  );
}

export function LogoComparison() {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-body-sm text-muted-foreground">
        Compare all logo directions at the sizes used in the product: 16px favicon, 28px sidebar,
        and 56px login. Pick one static mark; Option C is an animation layer you can add on top.
      </p>
      <div className="grid gap-5 xl:grid-cols-2">
        {VARIANTS.map((entry) => (
          <VariantCard key={entry.id} {...entry} />
        ))}
      </div>
    </div>
  );
}
