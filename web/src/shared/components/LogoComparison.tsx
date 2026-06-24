"use client";

import { Logo } from "@/shared/components/Logo";
import { type LogoVariant } from "@/shared/components/logo-variants";
import { cn } from "@/shared/lib/utils";

const PREVIEW_SIZES = [16, 28, 56] as const;

const VARIANTS: Array<{
  id: LogoVariant | "synaptic-s-animated";
  variant: LogoVariant;
  animated?: boolean;
  badge?: string;
}> = [
  { id: "diagonal", variant: "diagonal", badge: "Current" },
  { id: "synaptic-s", variant: "synaptic-s" },
  { id: "synaptic-s-animated", variant: "synaptic-s", animated: true, badge: "Option C" },
  { id: "glyph", variant: "glyph", badge: "Option B" },
  { id: "legacy", variant: "legacy", badge: "Previous" },
];

const VARIANT_COPY: Record<
  (typeof VARIANTS)[number]["id"],
  { title: string; note: string }
> = {
  diagonal: {
    title: "Diagonal synapse",
    note: "Primary mark. Two terminals on a 45° axis with a cleft and signal pulse.",
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
      <div className={cn("flex h-24 items-center justify-center rounded-xl border border-border/60", className)}>
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
    <article className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-subtitle-lg">{copy.title}</h3>
            {badge ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-caption-bold text-muted-foreground">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-body-sm text-muted-foreground">{copy.note}</p>
        </div>
        <Logo size={56} variant={variant} tone="auto" animated={animated} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PREVIEW_SIZES.map((size) => (
          <div key={size} className="flex flex-col items-center gap-2 rounded-xl bg-muted/30 px-3 py-4">
            <Logo
              size={size}
              variant={variant}
              tone="auto"
              animated={animated}
              className={size === 28 ? "rounded-full" : size === 56 ? "rounded-lg" : undefined}
            />
            <span className="text-caption-bold text-muted-foreground">{size}px</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <PreviewSurface label="Theme auto" className="bg-background">
          <Logo size={40} variant={variant} tone="auto" animated={animated} />
        </PreviewSurface>
        <PreviewSurface label="On light" className="bg-white">
          <Logo size={40} variant={variant} tone="on-light" animated={animated} />
        </PreviewSurface>
        <PreviewSurface label="On dark" className="bg-[#101114]">
          <Logo size={40} variant={variant} tone="on-dark" animated={animated} />
        </PreviewSurface>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <p className="text-body-sm-bold">Sidebar lockup preview</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-3">
          <Logo
            size={28}
            variant={variant}
            tone="auto"
            animated={animated}
            className="rounded-full"
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
