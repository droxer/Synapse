"use client";

import { useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "@/i18n";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("[app/error]", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-[28rem] flex-col items-center gap-4 px-6 text-center">
        <h1 className="w-full text-balance text-heading-sm text-foreground">
          {t("error.title")}
        </h1>
        <p className="w-full text-body-sm text-muted-foreground">
          {t("error.fallback")}
        </p>
        <Button onClick={reset}>
          {t("error.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
