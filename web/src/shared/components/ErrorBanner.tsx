"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "@/i18n";

interface ErrorBannerProps {
  readonly message: string;
  readonly onDismiss: () => void;
  readonly variant?: "default" | "compact";
  readonly dismissLabel?: string;
}

export function ErrorBanner({ message, onDismiss, variant = "default", dismissLabel }: ErrorBannerProps) {
  const { t } = useTranslation();
  const isCompact = variant === "compact";
  const resolvedDismissLabel = dismissLabel ?? t("shared.errorBanner.dismiss");

  return (
    <motion.div
      role="alert"
      className={cn(
        "flex items-center gap-2 bg-danger-subtle",
        isCompact
          ? "rounded-md px-3 py-2"
          : "rounded-lg px-4 py-2.5",
      )}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words text-sm text-destructive">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={resolvedDismissLabel}
        className="rounded-full p-1 text-destructive/70 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
