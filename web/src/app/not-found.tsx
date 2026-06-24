"use client";

import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "@/i18n";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="card-product-feature flex w-full max-w-[28rem] flex-col items-center gap-4 text-center">
        <h1 className="w-full text-heading-sm text-foreground">
          {t("notFound.title")}
        </h1>
        <p className="w-full text-body-sm text-muted-foreground">
          {t("notFound.message")}
        </p>
        <Button asChild variant="default">
          <Link href="/">{t("notFound.backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
