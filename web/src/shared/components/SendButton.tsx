"use client";

import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "@/i18n";

interface SendButtonProps {
  readonly disabled?: boolean;
  readonly hasContent?: boolean;
}

export function SendButton({ disabled = false, hasContent = false }: SendButtonProps) {
  const { t } = useTranslation();
  return (
    <motion.button
      type="submit"
      disabled={disabled || !hasContent}
      aria-label={hasContent ? t("chat.sendMessage") : t("chat.typeToSend")}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{
        scale: hasContent ? 1 : 0.85,
        opacity: hasContent ? 1 : 0.5,
      }}
      exit={{ scale: 0.85, opacity: 0 }}
      whileTap={hasContent ? { scale: 0.95 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(
        "touch-target flex size-8 shrink-0 items-center justify-center rounded-sm",
        "transition-[color,background-color] duration-200 ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        hasContent
          ? [
              "bg-primary text-primary-foreground",
              "hover:bg-accent-hover",
            ]
          : "bg-transparent text-placeholder cursor-default",
      )}
    >
      <ArrowUp
        className="h-3.5 w-3.5"
        aria-hidden="true"
        strokeWidth={2.5}
      />
    </motion.button>
  );
}
