"use client";

import { Download, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/i18n";
import { cn } from "@/shared/lib/utils";
import {
  fileExtension,
  formatFileSize,
  fileCategoryColor,
} from "@/features/agent-computer/lib/artifact-helpers";
import { BrandFileTypeIcon } from "@/shared/components/file-type-icons/BrandFileTypeIcon";
import { formatRelativeDate } from "@/shared/lib/format-relative-date";
import type { ArtifactExplorerItem } from "./artifactExplorerUtils";
import { FILE_ACTION_CLASS, FILE_DELETE_ACTION_CLASS } from "./explorerStyles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExplorerListRowProps {
  item: ArtifactExplorerItem;
  index: number;
  isPreviewOpen: boolean;
  canDelete?: boolean;
  onPreview: (item: ArtifactExplorerItem) => void;
  onDownload: (item: ArtifactExplorerItem) => void;
  onOpenDeleteDialog: (artifactIds: readonly string[]) => void;
  /** Hide the conversation title label below the filename (e.g. when rendered inside a group with a visible header) */
  hideConversationLabel?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExplorerListRow({
  item,
  index,
  isPreviewOpen,
  canDelete = false,
  onPreview,
  onDownload,
  onOpenDeleteDialog,
  hideConversationLabel = false,
}: ExplorerListRowProps) {
  const { t, locale } = useTranslation();
  const ext = fileExtension(item.name);
  const sizeText = formatFileSize(item.size, t);
  const { relative: relativeDate, absolute: absoluteDate } = item.createdAt
    ? formatRelativeDate(item.createdAt, locale)
    : { relative: "", absolute: "" };

  const { icon: iconColor } = fileCategoryColor(item.contentType, item.name);
  return (
    <motion.div
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 transition-colors duration-150 ease-out",
        isPreviewOpen ? "bg-sidebar-active" : "bg-muted/60 hover:bg-sidebar-hover",
      )}
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.1, delay: Math.min(index * 0.01, 0.15) }}
    >
      {/* File icon */}
      <div className="shrink-0 flex items-center justify-center w-6 h-6">
        <BrandFileTypeIcon
          name={item.name}
          contentType={item.contentType}
          className={cn("h-5 w-5", iconColor)}
        />
      </div>

      {/* Name + conversation label — clickable to preview */}
      <button
        type="button"
        data-file-card-preview="true"
        aria-label={t("shared.explorer.preview", { name: item.name })}
        onClick={() => onPreview(item)}
        className="min-w-0 flex-1 rounded-md py-[11px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
      >
        <p className="truncate text-sm font-medium text-foreground leading-snug" title={item.name}>
          {item.name}
        </p>
        {!hideConversationLabel && item.conversationTitle && (
          <p className="truncate text-xs text-text-subtle mt-0.5">
            {item.conversationTitle}
          </p>
        )}
      </button>

      {/* Metadata: type badge + size + date */}
      <div className="shrink-0 hidden sm:flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
        {ext && (
          <span className="rounded bg-background px-1.5 py-0.5 font-mono text-micro uppercase tracking-wide text-muted-foreground">
            {ext}
          </span>
        )}
        <span className="w-14 text-right">{sizeText}</span>
        {relativeDate && (
          <span className="w-20 text-right" title={absoluteDate}>
            {relativeDate}
          </span>
        )}
      </div>

      {canDelete && (
        <button
          type="button"
          aria-label={t("explorer.deleteFileLabel", { name: item.name })}
          onClick={(e) => { e.stopPropagation(); onOpenDeleteDialog([item.id]); }}
          className={FILE_DELETE_ACTION_CLASS}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        aria-label={t("shared.explorer.download", { name: item.name })}
        onClick={(e) => { e.stopPropagation(); onDownload(item); }}
        className={FILE_ACTION_CLASS}
      >
        <Download aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
