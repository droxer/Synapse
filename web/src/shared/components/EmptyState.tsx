"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title?: string;
  readonly description: string;
  readonly dashed?: boolean;
  readonly className?: string;
  readonly animate?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  dashed = false,
  className,
  animate = true,
}: EmptyStateProps) {
  const Container = animate ? motion.div : "div";
  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.15, ease: "easeOut" as const },
      }
    : {};

  return (
    <Container
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        dashed && "rounded-xl bg-muted/60 py-14",
        className,
      )}
      {...motionProps}
    >
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", dashed ? "bg-background" : "bg-muted")}>
              <Icon className="h-5 w-5 text-placeholder" aria-hidden="true" />
      </div>
      {title || description ? (
        <div className="text-center">
          {title && (
            <p className="text-body-sm-bold text-balance text-foreground">{title}</p>
          )}
          <p className={cn("text-xs text-pretty text-muted-foreground", title && "mt-0.5")}>
            {description}
          </p>
        </div>
      ) : null}
    </Container>
  );
}
