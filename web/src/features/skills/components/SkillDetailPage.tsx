"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Lightbulb,
  SearchX,
  Trash2,
  FileCode,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { useSkillsCache } from "../hooks/use-skills-cache";
import { useSkillFiles } from "../hooks/use-skill-files";
import { normalizeSkillName } from "../lib/normalize-skill-name";
import { SOURCE_STYLE, SOURCE_LABEL_KEY, isUninstallableSource } from "../lib/skill-source-styles";
import { uninstallSkill } from "../api/skills-api";
import { useTranslation } from "@/i18n";
import { FileTree } from "./FileTree";
import { FileContentViewer } from "./FileContentViewer";

const SKELETON_ROW_COUNT = 6;

/** Deterministic widths so server and client skeleton markup match. */
function skeletonRowWidth(index: number): string {
  return `${60 + ((index * 7) % 40)}%`;
}

function TreeSkeletonRows() {
  return (
    <>
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        <div key={i} className="h-5 skeleton-shimmer rounded" style={{ width: skeletonRowWidth(i) }} />
      ))}
    </>
  );
}

interface SkillDetailPageProps {
  readonly name: string;
}

function DetailSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background" aria-busy="true">
      {/* Header skeleton */}
      <div className="shrink-0 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 skeleton-shimmer rounded-md" />
          <div className="h-9 w-9 skeleton-shimmer rounded-lg" />
          <div className="space-y-1.5">
            <div className="h-5 w-40 skeleton-shimmer rounded" />
            <div className="h-3 w-20 skeleton-shimmer rounded" />
          </div>
        </div>
      </div>
      {/* Body skeleton: sidebar + content */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[250px] md:shrink-0 max-h-[200px] md:max-h-none overflow-y-auto bg-muted p-3 space-y-2">
          <TreeSkeletonRows />
        </div>
        <div className="flex-1 p-6 space-y-3">
          <div className="h-4 w-3/4 skeleton-shimmer rounded" />
          <div className="h-4 w-full skeleton-shimmer rounded" />
          <div className="h-4 w-5/6 skeleton-shimmer rounded" />
          <div className="h-4 w-2/3 skeleton-shimmer rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkillDetailPage({ name }: SkillDetailPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { getSkill, isSkillMissing, refetch } = useSkillsCache();
  const skill = getSkill(name);

  const {
    fileTree,
    selectedPath,
    fileContent,
    isLoadingTree,
    isLoadingContent,
    selectFile,
  } = useSkillFiles(name);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    setError(null);
    try {
      await uninstallSkill(name);
      refetch();
      router.push("/skills");
    } catch (err) {
      console.error("Skill uninstall failed", err);
      setError(t("skills.errors.uninstall"));
      setShowDeleteDialog(false);
    }
  }, [name, refetch, router, t]);

  if (!skill) {
    if (isSkillMissing(name)) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6">
          <EmptyState
            icon={SearchX}
            title={t("skills.notFoundTitle")}
            description={t("skills.notFoundDescription")}
            className="w-full max-w-md rounded-xl bg-muted py-14"
          />
          <Button variant="secondary" size="sm" asChild>
            <Link href="/skills">
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              {t("skills.backToSkills")}
            </Link>
          </Button>
        </div>
      );
    }
    return <DetailSkeleton />;
  }

  const config = SOURCE_STYLE[skill.source_type] ?? SOURCE_STYLE.bundled;
  const SourceIcon = config.icon;
  const labelKey =
    SOURCE_LABEL_KEY[skill.source_type] ?? SOURCE_LABEL_KEY.bundled;
  const showDelete = isUninstallableSource(skill.source_type);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Header ── */}
      <div className="shrink-0 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/skills" aria-label={t("skills.backToSkills")}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Button>

          <div className="chip-muted flex h-9 w-9 shrink-0 items-center justify-center">
            <Lightbulb aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-heading-sm text-foreground">
              {normalizeSkillName(skill.name)}
            </h1>
            {skill.description && (
              <p className="truncate text-body-sm text-muted-foreground">
                {skill.description}
              </p>
            )}
          </div>

          <Badge variant={config.badgeVariant}>
            <SourceIcon aria-hidden="true" />
            {t(labelKey)}
          </Badge>

          {showDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
              aria-label={`${t("skills.uninstall")} ${normalizeSkillName(skill.name)}`}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-3">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              variant="compact"
              dismissLabel={t("skills.dismissError")}
            />
          </div>
        )}
      </div>

      {/* ── Body: File Tree + Content Viewer ── */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Sidebar: File Tree */}
        <div className="w-full md:w-[250px] md:shrink-0 max-h-[280px] md:max-h-none overflow-y-auto bg-muted">
          {isLoadingTree ? (
            <div className="p-3 space-y-2" aria-busy="true">
              <TreeSkeletonRows />
            </div>
          ) : fileTree.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-caption text-text-subtle">
                {t("skills.noFiles")}
              </p>
            </div>
          ) : (
            <FileTree
              nodes={fileTree}
              selectedPath={selectedPath}
              onSelectFile={selectFile}
              ariaLabel={t("skills.fileTreeLabel")}
            />
          )}
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-hidden">
          {selectedPath && fileContent !== null ? (
            <FileContentViewer
              path={selectedPath}
              content={fileContent}
              isLoading={isLoadingContent}
            />
          ) : isLoadingContent ? (
            <div className="flex flex-col gap-3 p-6" aria-busy="true">
              <div className="h-4 w-3/4 skeleton-shimmer rounded" />
              <div className="h-4 w-full skeleton-shimmer rounded" />
              <div className="h-4 w-5/6 skeleton-shimmer rounded" />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <FileCode aria-hidden="true" className="h-10 w-10 text-text-subtle" />
              <p className="text-body-sm text-text-subtle">
                {t("skills.noFileSelected")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("skills.uninstallTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("skills.uninstallDesc", {
                name: normalizeSkillName(skill.name),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("skills.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {t("skills.uninstall")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
