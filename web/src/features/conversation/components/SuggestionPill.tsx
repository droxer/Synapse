"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface SuggestionPillProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function SuggestionPill({ label, icon, onClick, disabled = false, "aria-label": ariaLabel }: SuggestionPillProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: "easeOut" }}
      onClick={onClick}
      className="touch-target inline-flex min-h-9 items-center gap-2 rounded-sm bg-surface-soft px-3 text-body-sm text-ink-deep transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-surface-soft),var(--color-ink-deep)_6%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}
