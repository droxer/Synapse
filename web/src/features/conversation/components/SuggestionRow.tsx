"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CornerDownLeft } from "lucide-react";

interface SuggestionRowProps {
  label: string;
  prompt: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function SuggestionRow({
  label,
  prompt,
  icon,
  onClick,
  disabled = false,
  "aria-label": ariaLabel,
}: SuggestionRowProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.12, ease: "easeOut" }}
      onClick={onClick}
      className="group touch-target flex w-full min-w-0 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-surface-soft text-steel transition-colors duration-150 group-hover:bg-surface-hover group-hover:text-ink-deep">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
        <span className="shrink-0 text-body-sm-bold text-ink-deep">{label}</span>
        <span className="min-w-0 truncate text-body-sm text-steel">{prompt}</span>
      </span>
      <CornerDownLeft
        className="h-3.5 w-3.5 shrink-0 text-stone opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      />
    </motion.button>
  );
}
