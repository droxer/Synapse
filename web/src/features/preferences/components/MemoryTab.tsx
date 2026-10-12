"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { TabHeader } from "./TabHeader";
import { useTranslation } from "@/i18n";
import { useMemoryEntries } from "../hooks/use-memory-entries";
import { RetryableError } from "./RetryableError";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { cn } from "@/shared/lib/utils";
import { formatRelativeTimeFromIso } from "@/shared/lib/date-time";

const MEMORY_GRID =
  "md:grid md:grid-cols-[180px_minmax(0,1fr)_100px_100px_40px] md:items-center md:gap-3";

const listItem = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.1, ease: "easeOut" as const } },
};

function truncateValue(value: string, maxLen = 80): string {
  return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
}

function ScopeChip({ scope, label }: { readonly scope: "global" | "conversation"; readonly label: string }) {
  return (
    <Badge variant={scope === "global" ? "info" : "neutral"}>{label}</Badge>
  );
}

function DeleteMemoryButton({
  entryKey,
  disabled,
  onConfirm,
  size = "desktop",
}: {
  readonly entryKey: string;
  readonly disabled: boolean;
  readonly onConfirm: () => void;
  readonly size?: "desktop" | "mobile";
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={size === "mobile" ? "icon" : "icon-sm"}
          aria-label={`${t("explorer.delete")} ${entryKey}`}
          className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("preferences.memory.confirmDeleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("preferences.memory.confirmDeleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="font-mono text-caption text-foreground break-all">{entryKey}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("explorer.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t("explorer.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MemoryTab() {
  const { t, locale } = useTranslation();
  const { items, loading, error, page, totalPages, loadPage, deleteEntry } =
    useMemoryEntries();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (entryId: string) => {
    setDeletingId(entryId);
    try {
      await deleteEntry(entryId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <TabHeader
        eyebrow={t("preferences.tabs.memory")}
        title={t("preferences.memory.title")}
        description={t("preferences.memory.description")}
      />

      {error && (
        <RetryableError
          className="mb-4"
          message={error}
          onRetry={() => loadPage(page)}
        />
      )}

      <div role="table" aria-label={t("preferences.memory.title")} className="overflow-hidden rounded-xl bg-muted/60">
        <div
          role="row"
          className="hidden grid-cols-[180px_minmax(0,1fr)_100px_100px_40px] gap-3 px-4 py-3 label-section text-muted-foreground md:grid"
        >
          <span role="columnheader">{t("preferences.memory.key")}</span>
          <span role="columnheader">{t("preferences.memory.value")}</span>
          <span role="columnheader">{t("preferences.memory.scope")}</span>
          <span role="columnheader" className="text-right">{t("preferences.memory.lastUpdated")}</span>
          <span role="columnheader"><span className="sr-only">{t("explorer.delete")}</span></span>
        </div>

        {loading && items.length === 0 ? (
          <div className="px-3 py-6 text-center" aria-busy="true">
            <span className="sr-only" role="status">{t("preferences.loading")}</span>
            <span aria-hidden="true" className="inline-block h-4 w-24 skeleton-shimmer rounded" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-body-sm text-muted-foreground">
            {t("preferences.memory.noData")}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.02 } },
            }}
          >
            {items.map((entry) => {
              const scopeLabel = entry.scope === "global"
                ? t("preferences.memory.global")
                : t("preferences.memory.conversation");
              const updatedLabel = formatRelativeTimeFromIso(entry.updated_at, locale);
              return (
                <motion.div
                  key={entry.id}
                  role="row"
                  variants={listItem}
                  className="px-4 py-3 text-body-sm transition-colors duration-100 hover:bg-muted"
                >
                  <div role="cell" className="md:hidden">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <span
                        className="min-w-0 truncate font-mono text-caption font-medium text-foreground"
                        title={entry.key}
                      >
                        {entry.key}
                      </span>
                      <DeleteMemoryButton
                        entryKey={entry.key}
                        disabled={deletingId === entry.id}
                        onConfirm={() => handleDelete(entry.id)}
                        size="mobile"
                      />
                    </div>
                    <p
                      className="mt-2 min-w-0 text-caption leading-relaxed text-muted-foreground"
                      title={entry.value}
                    >
                      {truncateValue(entry.value)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ScopeChip scope={entry.scope} label={scopeLabel} />
                      <span className="font-mono text-micro text-text-subtle">
                        {t("preferences.memory.lastUpdated")}: {updatedLabel}
                      </span>
                    </div>
                  </div>

                  <div className={cn("hidden", MEMORY_GRID)}>
                    <span
                      role="cell"
                      className="min-w-0 truncate font-mono text-caption font-medium text-foreground"
                      title={entry.key}
                    >
                      {entry.key}
                    </span>
                    <p
                      role="cell"
                      className="min-w-0 truncate text-caption leading-relaxed text-muted-foreground"
                      title={entry.value}
                    >
                      {truncateValue(entry.value)}
                    </p>
                    <span role="cell">
                      <ScopeChip scope={entry.scope} label={scopeLabel} />
                    </span>
                    <span role="cell" className="text-right text-caption text-muted-foreground">
                      {updatedLabel}
                    </span>
                    <span role="cell">
                      <DeleteMemoryButton
                        entryKey={entry.key}
                        disabled={deletingId === entry.id}
                        onConfirm={() => handleDelete(entry.id)}
                      />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => loadPage(page - 1)}
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            {t("preferences.memory.previous")}
          </Button>
          <span className="text-caption text-muted-foreground">
            {t("preferences.memory.page", {
              current: page + 1,
              total: totalPages,
            })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => loadPage(page + 1)}
          >
            {t("preferences.memory.next")}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
