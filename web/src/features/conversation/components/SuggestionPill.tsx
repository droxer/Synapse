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
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-card px-4 text-body-sm font-medium text-ink-deep transition-colors duration-150 hover:border-charcoal hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}
