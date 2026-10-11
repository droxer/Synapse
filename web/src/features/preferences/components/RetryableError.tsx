"use client";

import { useState } from "react";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "@/i18n";
import { cn } from "@/shared/lib/utils";

interface RetryableErrorProps {
  readonly message: string;
  readonly onRetry: () => void;
  readonly className?: string;
}

/**
 * Error banner with an explicit Retry action. Dismiss only hides the banner
 * for the current message; it never triggers a reload on its own.
 */
export function RetryableError({ message, onRetry, className }: RetryableErrorProps) {
  const { t } = useTranslation();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  if (dismissedMessage === message) return null;

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <div className="min-w-0 flex-1">
        <ErrorBanner
          message={message}
          variant="compact"
          onDismiss={() => setDismissedMessage(message)}
          dismissLabel={t("preferences.dismissError")}
        />
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
        {t("preferences.retry")}
      </Button>
    </div>
  );
}
