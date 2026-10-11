"use client";

import type { ReactNode } from "react";
import { Check, CircleX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** Resolution state shared by every activity row (tools, skills, steps, agents). */
export type ToolStatusTone = "running" | "complete" | "error";

const GLYPH_COLOR_BY_TONE: Record<ToolStatusTone, string> = {
  running: "text-ring",
  complete: "text-foreground",
  error: "text-destructive",
};

const CORNER_MARK_CLASSES =
  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-background";

interface ToolStatusGlyphProps {
  readonly glyph: LucideIcon;
  readonly tone: ToolStatusTone;
  /** Accessible status text, e.g. "Tool running". */
  readonly label: string;
  readonly className?: string;
}

/**
 * Single source of truth for the tool/skill/step status icon:
 * a tonal tile with the tool glyph, plus a corner mark (check / x) once
 * resolved, or a soft pulse while running.
 */
export function ToolStatusGlyph({ glyph: Glyph, tone, label, className }: ToolStatusGlyphProps) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted",
        className,
      )}
    >
      <Glyph aria-hidden="true" className={cn("h-3.5 w-3.5", GLYPH_COLOR_BY_TONE[tone])} strokeWidth={2.25} />
      {tone === "complete" && (
        <Check aria-hidden="true" className={cn(CORNER_MARK_CLASSES, "text-success-text")} strokeWidth={3} />
      )}
      {tone === "error" && (
        <CircleX aria-hidden="true" className={cn(CORNER_MARK_CLASSES, "text-destructive")} strokeWidth={2.5} />
      )}
      {tone === "running" && (
        <span aria-hidden="true" className="absolute inset-0 rounded-md bg-ring/20 animate-pulsing-dot-fade" />
      )}
    </span>
  );
}

/** Shared "in progress" chip used next to running tools, skills, and agents. */
export function RunningBadge({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <span className={cn("status-pill status-info shrink-0", className)}>{children}</span>;
}
