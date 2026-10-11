"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Check } from "lucide-react";
import { MarkdownRenderer } from "@/shared/components/MarkdownRenderer";
import { cn } from "@/shared/lib/utils";
import { TOOLING_ACTIVITY_ROW_CLASSES } from "@/shared/lib/tooling-ui-styles";
import { normalizeSkillName } from "@/features/skills/lib/normalize-skill-name";
import { SOURCE_STYLE, SOURCE_LABEL_KEY } from "@/features/skills/lib/skill-source-styles";
import { useSkillsCache } from "@/features/skills/hooks/use-skills-cache";
import { useTranslation } from "@/i18n";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ACTIVITY_META_BADGE_CLASSES } from "@/shared/lib/activity-meta-badge";
import {
  PROSE_CLASSES,
  TOOL_OUTPUT_MARKDOWN_CLASSES,
  getToolCallTone,
  getToolCallVisualClasses,
} from "../lib/format-tools";
import { getSkillIcon } from "../lib/tool-visual-icons";
import { RunningBadge, ToolStatusGlyph } from "./ToolStatusGlyph";
import type { ToolCallInfo } from "@/shared/types";

/* ── helpers ── */

/** Count non-empty lines in output. */
function countLines(output?: string): number {
  if (!output) return 0;
  return output.split("\n").filter((l) => l.trim().length > 0).length;
}

/** Count resource files mentioned in the output. */
function countResources(output?: string): number {
  if (!output) return 0;
  const matches = output.match(/<file>/g);
  return matches?.length ?? 0;
}

/** Expandable error message for skill failures (L5). */
function ErrorMessage({ output, t }: { readonly output: string; readonly t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = output.length > 200;

  return (
    <div className="mt-1.5">
      <MarkdownRenderer
        content={expanded ? output : output.slice(0, 200)}
        className={cn(PROSE_CLASSES, TOOL_OUTPUT_MARKDOWN_CLASSES, "text-destructive", !expanded && "line-clamp-2")}
        compactCode
      />
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="mt-0.5 rounded text-micro font-medium text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={expanded ? t("skills.activity.hideError") : t("skills.activity.showError")}
          aria-expanded={expanded}
        >
          {expanded ? t("skills.activity.hideError") : t("skills.activity.showError")}
        </button>
      )}
    </div>
  );
}

/* ── component ── */

interface SkillActivityEntryProps {
  readonly toolCall: ToolCallInfo;
}

export function SkillActivityEntry({ toolCall }: SkillActivityEntryProps) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);
  const toggleRaw = useCallback(() => setShowRaw((p) => !p), []);

  const { getSkill, isLoading } = useSkillsCache();

  const skillName = String(toolCall.input.name ?? "unknown");
  const displayName = normalizeSkillName(skillName);
  const isResolved = toolCall.success !== undefined;
  const isComplete = toolCall.success === true;
  const isError = toolCall.success === false;

  const SkillGlyph = useMemo(() => getSkillIcon(skillName), [skillName]);

  const skillMeta = getSkill(skillName);
  // Show skeletons only while cache is still loading; once loaded/failed, hide them
  const showSkeleton = skillMeta === null && isLoading;

  const lineCount = useMemo(() => countLines(toolCall.output), [toolCall.output]);
  const resourceCount = useMemo(() => countResources(toolCall.output), [toolCall.output]);

  const sourceStyle = skillMeta?.source_type
    ? SOURCE_STYLE[skillMeta.source_type]
    : null;
  const sourceLabelKey = skillMeta?.source_type
    ? SOURCE_LABEL_KEY[skillMeta.source_type]
    : null;
  const tone = getToolCallTone(toolCall);
  const visual = getToolCallVisualClasses(tone);

  return (
    <motion.div
      data-step-id={`tool-${toolCall.id}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className={cn(
        TOOLING_ACTIVITY_ROW_CLASSES,
        visual.row,
        visual.rowHover,
      )}
    >
        {/* Main content */}
        <div className="flex items-start gap-2.5 py-0.5">
          <ToolStatusGlyph
            glyph={SkillGlyph}
            tone={isError ? "error" : isComplete ? "complete" : "running"}
            label={isError ? t("skills.activity.skillFailed") : isComplete ? t("skills.activity.skillLoaded") : t("skills.activity.skillLoading")}
          />

          {/* Text content */}
          <div className="min-w-0 flex-1">
            {/* Row 1: Name + status + source badge */}
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("min-w-0 truncate text-sm font-medium", visual.text)} title={displayName}>
                {displayName}
              </span>

              {isComplete && !isError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <span className="inline-flex shrink-0 items-center gap-1 text-micro font-medium text-success-text">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                    {t("skills.activity.loaded")}
                  </span>
                </motion.div>
              )}

              {!isResolved && (
                <RunningBadge>{t("skills.activity.loading")}</RunningBadge>
              )}

              {isError && (
                <span className="shrink-0 text-micro font-medium text-destructive">
                  {t("skills.activity.failed")}
                </span>
              )}

              {/* Source type badge — skeleton while loading, real badge when ready */}
              {sourceStyle && sourceLabelKey ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.12 }}
                  className="ml-auto shrink-0"
                >
                  <span className={cn(ACTIVITY_META_BADGE_CLASSES, sourceStyle.className)}>
                    {t(sourceLabelKey)}
                  </span>
                </motion.div>
              ) : showSkeleton ? (
                <span className="ml-auto shrink-0">
                  <Skeleton className="h-4 w-12" />
                </span>
              ) : null}
            </div>

            {/* Row 2: Description — skeleton while loading, real text when ready, hidden if empty */}
            {showSkeleton ? (
              <div className="mt-1.5 min-h-[18px]">
                <Skeleton className="h-3 w-48" />
              </div>
            ) : skillMeta?.description ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12 }}
                className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground"
              >
                {skillMeta.description}
              </motion.p>
            ) : null}

            {/* Row 3: Stats row — instructions + resources */}
            {isComplete && (lineCount > 0 || resourceCount > 0) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-1.5 flex items-center gap-2.5"
              >
                {lineCount > 0 && (
                  <span className="font-mono text-micro text-text-subtle">
                    {t("skills.activity.lines", { count: lineCount })}
                  </span>
                )}
                {resourceCount > 0 && (
                  <span className="font-mono text-micro text-text-subtle">
                    {resourceCount !== 1
                      ? t("skills.activity.resources", { count: resourceCount })
                      : t("skills.activity.resource", { count: resourceCount })}
                  </span>
                )}
              </motion.div>
            )}

            {/* Error message */}
            {isError && toolCall.output && (
              <ErrorMessage output={toolCall.output} t={t} />
            )}
          </div>

          {/* Expand raw toggle */}
          {isResolved && !isError && lineCount > 0 && (
            <button
              type="button"
              onClick={toggleRaw}
              className="mt-0.5 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-micro text-text-subtle transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={showRaw ? t("skills.activity.hideInstructions") : t("skills.activity.showInstructions")}
              aria-expanded={showRaw}
            >
              <motion.span
                animate={{ rotate: showRaw ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center"
              >
                <ChevronRight aria-hidden="true" className="h-3 w-3" />
              </motion.span>
            </button>
          )}
        </div>

        {/* Collapsible raw output */}
        <AnimatePresence>
          {showRaw && toolCall.output && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.12, ease: "easeInOut" }}
            >
              <div className="mt-1.5 rounded-lg bg-muted px-2.5 py-2">
                <pre className="max-h-48 overflow-auto overscroll-contain whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground md:max-h-64">
                  {toolCall.output}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </motion.div>
  );
}
