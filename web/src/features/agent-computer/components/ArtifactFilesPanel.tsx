"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { ArtifactPreviewDialog } from "@/features/agent-computer/components/ArtifactPreviewDialog";
import { formatFileSize, fileCategoryColor, fileCategory } from "@/features/agent-computer/lib/artifact-helpers";
import { BrandFileTypeIcon } from "@/shared/components/file-type-icons/BrandFileTypeIcon";
import { buildArtifactUrl } from "@/shared/components/ArtifactExplorer/artifactExplorerUtils";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useSessionFilteredArtifacts } from "@/shared/hooks/use-session-filtered-artifacts";
import { downloadFile } from "@/shared/lib/download";
import { formatRelativeDate } from "@/shared/lib/format-relative-date";
import { cn } from "@/shared/lib/utils";
import { useAppStore } from "@/shared/stores";
import type { ArtifactInfo } from "@/shared/types";
import {
  normalizeTaskArtifacts,
  type TaskArtifactItem,
} from "./ArtifactFilesPanel.utils";

function artifactFreshFingerprint(artifact: TaskArtifactItem): string {
  return `${artifact.size}|${artifact.contentType}|${artifact.name}|${artifact.filePath ?? ""}|${artifact.createdAt ?? ""}`;
}

interface ArtifactFilesPanelProps {
  readonly artifacts: readonly ArtifactInfo[];
  readonly conversationId: string | null;
}

function ArtifactMeta({ artifact }: { readonly artifact: TaskArtifactItem }) {
  const { t, locale } = useTranslation();
  const meta = artifact.createdAt ? formatRelativeDate(artifact.createdAt, locale) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>{formatFileSize(artifact.size, t)}</span>
      <span aria-hidden="true">•</span>
      <span>{fileCategory(artifact.contentType, t)}</span>
      {meta ? (
        <>
          <span aria-hidden="true">•</span>
          <span title={meta.absolute}>{meta.relative}</span>
        </>
      ) : null}
    </div>
  );
}

function ArtifactActions({
  artifact,
  conversationId,
  canDelete,
  onPreview,
  onDelete,
}: {
  readonly artifact: TaskArtifactItem;
  readonly conversationId: string | null;
  readonly canDelete: boolean;
  readonly onPreview: (artifact: TaskArtifactItem) => void;
  readonly onDelete: (artifactIds: readonly string[]) => void;
}) {
  const { t } = useTranslation();
  const url = buildArtifactUrl(artifact, conversationId);

  return (
    <div className="flex items-center gap-1.5">
      {artifact.isPreviewable ? (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("artifacts.preview")}
          className="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          onClick={() => onPreview(artifact)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ) : null}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t("artifacts.downloadFile")}
        className="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
        onClick={() => {
          if (url) downloadFile(url, artifact.name);
        }}
      >
        <Download className="h-4 w-4" />
      </Button>
      {canDelete ? (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("explorer.deleteFileLabel", { name: artifact.name })}
          className="border-transparent text-muted-foreground hover:border-border hover:text-destructive"
          onClick={() => onDelete([artifact.id])}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function ArtifactListRow({
  artifact,
  conversationId,
  canDelete,
  onPreview,
  onDelete,
  isFresh,
}: {
  readonly artifact: TaskArtifactItem;
  readonly conversationId: string | null;
  readonly canDelete: boolean;
  readonly onPreview: (artifact: TaskArtifactItem) => void;
  readonly onDelete: (artifactIds: readonly string[]) => void;
  readonly isFresh: boolean;
}) {
  const { t } = useTranslation();
  const { bg, icon } = fileCategoryColor(artifact.contentType, artifact.name);
  const fileIcon = (
    <BrandFileTypeIcon
      name={artifact.name}
      contentType={artifact.contentType}
      className={cn("h-5 w-5", icon)}
    />
  );

  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/70">
      {artifact.isPreviewable ? (
        <button
          type="button"
          aria-label={t("artifacts.preview")}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
            bg,
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          onClick={() => onPreview(artifact)}
        >
          {fileIcon}
        </button>
      ) : (
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", bg)}>
          {fileIcon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{artifact.name}</p>
          {isFresh ? (
            <span className="shrink-0 text-micro font-medium text-success">
              {t("artifacts.new")}
            </span>
          ) : null}
        </div>
        <ArtifactMeta artifact={artifact} />
        {artifact.directory ? (
          <p className="truncate text-xs text-muted-foreground">{artifact.directory}</p>
        ) : null}
      </div>
      <ArtifactActions
        artifact={artifact}
        conversationId={conversationId}
        canDelete={canDelete}
        onPreview={onPreview}
        onDelete={onDelete}
      />
    </div>
  );
}

export function ArtifactFilesPanel({ artifacts, conversationId }: ArtifactFilesPanelProps) {
  const { t } = useTranslation();
  const filteredArtifacts = useSessionFilteredArtifacts(artifacts);
  const normalizedArtifacts = useMemo(
    () => normalizeTaskArtifacts(filteredArtifacts),
    [filteredArtifacts],
  );

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [deleteTargetIds, setDeleteTargetIds] = useState<readonly string[] | null>(null);
  const [freshArtifactIds, setFreshArtifactIds] = useState<ReadonlySet<string>>(new Set());
  const previousFingerprintByIdRef = useRef<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    const nextIds = new Set(normalizedArtifacts.map((artifact) => artifact.id));
    const prevFpById = previousFingerprintByIdRef.current;

    const toMarkFresh: string[] = [];
    if (prevFpById.size > 0) {
      for (const artifact of normalizedArtifacts) {
        const fp = artifactFreshFingerprint(artifact);
        const prevFp = prevFpById.get(artifact.id);
        if (prevFp === undefined || prevFp !== fp) {
          toMarkFresh.push(artifact.id);
        }
      }
    }

    const nextFpById = new Map<string, string>();
    for (const artifact of normalizedArtifacts) {
      nextFpById.set(artifact.id, artifactFreshFingerprint(artifact));
    }
    previousFingerprintByIdRef.current = nextFpById;

    setFreshArtifactIds((prev) => {
      const next = new Set([...prev].filter((id) => nextIds.has(id)));
      for (const id of toMarkFresh) next.add(id);
      return next;
    });
  }, [normalizedArtifacts]);

  const selectedArtifact = useMemo(
    () => normalizedArtifacts.find((artifact) => artifact.id === selectedFileId) ?? null,
    [normalizedArtifacts, selectedFileId],
  );

  const selectedArtifactUrl = useMemo(
    () => (selectedArtifact ? buildArtifactUrl(selectedArtifact, conversationId) : null),
    [selectedArtifact, conversationId],
  );

  const performDelete = useCallback(async (ids: readonly string[]): Promise<boolean> => {
    if (!conversationId || ids.length === 0) return false;
    try {
      const response = await fetch(`/api/conversations/${conversationId}/artifacts/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifact_ids: ids }),
      });
      if (!response.ok) return false;

      useAppStore.getState().recordArtifactsDeleted(ids);
      setFreshArtifactIds((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      if (selectedFileId && ids.includes(selectedFileId)) setSelectedFileId(null);
      return true;
    } catch (error) {
      console.error("Failed to delete artifacts", error);
      return false;
    }
  }, [conversationId, selectedFileId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetIds?.length) return;
    const ok = await performDelete(deleteTargetIds);
    if (ok) setDeleteTargetIds(null);
  }, [deleteTargetIds, performDelete]);

  if (normalizedArtifacts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">{t("artifacts.noFiles")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("library.noArtifactsHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-y-auto bg-background px-3 py-3 sm:px-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 px-2">
          <span className="label-mono text-muted-foreground">{t("artifacts.recentOutputs")}</span>
          <span className="text-sm font-medium text-foreground">
            {normalizedArtifacts.length === 1
              ? t("artifacts.fileCount", { count: normalizedArtifacts.length })
              : t("artifacts.filesCount", { count: normalizedArtifacts.length })}
          </span>
          {freshArtifactIds.size > 0 ? (
            <span className="text-micro font-medium text-success">
              {t("artifacts.newSinceOpen", { count: freshArtifactIds.size })}
            </span>
          ) : null}
        </div>

        <div className="divide-y divide-border/70">
          {normalizedArtifacts.map((artifact) => (
            <ArtifactListRow
              key={artifact.id}
              artifact={artifact}
              conversationId={conversationId}
              canDelete={Boolean(conversationId)}
              onPreview={(item) => setSelectedFileId(item.id)}
              onDelete={(ids) => setDeleteTargetIds(ids)}
              isFresh={freshArtifactIds.has(artifact.id)}
            />
          ))}
        </div>
      </div>

      <ArtifactPreviewDialog
        artifact={selectedArtifact}
        artifactUrl={selectedArtifactUrl}
        open={selectedArtifact !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedFileId(null);
        }}
        onRequestDelete={conversationId ? () => setDeleteTargetIds(selectedArtifact ? [selectedArtifact.id] : null) : undefined}
      />

      <AlertDialog open={Boolean(deleteTargetIds?.length)} onOpenChange={(open) => !open && setDeleteTargetIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("explorer.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("explorer.deleteConfirmDesc", { count: deleteTargetIds?.length ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("explorer.cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t("explorer.deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
