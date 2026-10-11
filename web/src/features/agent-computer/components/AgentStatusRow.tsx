"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleCheck, GitFork, CircleX, ChevronRight, ArrowRightLeft, AlertTriangle, Minus } from "lucide-react";
import { MarkdownRenderer } from "@/shared/components/MarkdownRenderer";
import { PulsingDot } from "@/shared/components/PulsingDot";
import { cn } from "@/shared/lib/utils";
import { TOOLING_ACTIVITY_ROW_CLASSES } from "@/shared/lib/tooling-ui-styles";
import { normalizeToolNameI18n, normalizeAgentName } from "../lib/tool-constants";
import { ToolOutputRenderer } from "./ToolOutputRenderer";
import { ToolArgsDisplay } from "./ToolArgsDisplay";
import { SkillActivityEntry } from "./SkillActivityEntry";
import { RunningBadge, ToolStatusGlyph, type ToolStatusTone } from "./ToolStatusGlyph";
import { useTranslation } from "@/i18n";
import {
  EVENT_LEFT_RAIL_CLASSES,
  EVENT_META_BADGE_CLASSES,
  PROSE_CLASSES,
  EVENT_ROW_BASE_CLASSES,
  SKILL_TOOL_NAMES,
  TOOL_OUTPUT_MARKDOWN_CLASSES,
  getToolCallTone,
  getToolCallVisualClasses,
} from "../lib/format-tools";
import { getSkillIcon, getToolIcon } from "../lib/tool-visual-icons";
import type { AgentStatus, ToolCallInfo } from "@/shared/types";

function ToolStatusIcon({ tc, label }: { readonly tc: ToolCallInfo; readonly label: string }) {
  const isSkill = SKILL_TOOL_NAMES.has(tc.name);
  const skillId = isSkill ? String(tc.input.name ?? "").trim() : "";
  const ToolGlyph = skillId ? getSkillIcon(skillId) : getToolIcon(tc.name);
  const tone: ToolStatusTone = tc.success === undefined ? "running" : tc.success ? "complete" : "error";
  return <ToolStatusGlyph glyph={ToolGlyph} tone={tone} label={label} />;
}

function AgentStatusIcon({ status, label }: { readonly status: AgentStatus["status"]; readonly label: string }) {
  if (status === "running") {
    return (
      <span role="img" aria-label={label} className="flex shrink-0 items-center">
        <PulsingDot size="sm" />
      </span>
    );
  }
  const Icon = status === "complete"
    ? CircleCheck
    : status === "skipped"
      ? Minus
      : status === "replan_required"
        ? AlertTriangle
        : CircleX;
  const color = status === "complete"
    ? "text-success-text"
    : status === "skipped"
      ? "text-muted-foreground"
      : status === "replan_required"
        ? "text-warning-text"
        : "text-destructive";
  return <Icon role="img" aria-label={label} className={cn("h-4 w-4 shrink-0", color)} />;
}

const AGENT_STATUS_LABEL_KEY: Record<string, string> = {
  complete: "a11y.agentStatusComplete",
  error: "a11y.agentStatusError",
  skipped: "a11y.agentStatusSkipped",
  replan_required: "a11y.agentStatusReplan",
  running: "a11y.agentStatusRunning",
};

interface AgentStatusRowProps {
  readonly agent: AgentStatus;
  readonly toolCalls?: ToolCallInfo[];
  readonly conversationId?: string | null;
  readonly agentNameMap?: ReadonlyMap<string, string>;
}

export function AgentStatusRow({
  agent,
  toolCalls,
  conversationId,
  agentNameMap,
}: AgentStatusRowProps) {
  const { t } = useTranslation();
  const hasTools = toolCalls && toolCalls.length > 0;
  const hasSummary = Boolean(agent.summary?.trim());
  const agentLabel = normalizeAgentName(agent.name || agent.description.split(" → ")[0] || agent.description);
  const completedToolCount = toolCalls?.filter((tc) => tc.output !== undefined).length ?? 0;
  const totalToolCount = toolCalls?.length ?? 0;
  const rawAgentToolProgressLabel = t("a11y.agentToolProgress", {
    agent: agentLabel,
    completed: completedToolCount,
    total: totalToolCount,
  });
  const agentToolProgressLabel =
    rawAgentToolProgressLabel === "a11y.agentToolProgress"
      ? `${completedToolCount}/${totalToolCount}`
      : rawAgentToolProgressLabel;
  const expandAgentToolsLabel = t("a11y.expandAgentTools", {
    agent: agentLabel,
    progress: agentToolProgressLabel,
  });
  const collapseAgentToolsLabel = t("a11y.collapseAgentTools", {
    agent: agentLabel,
    progress: agentToolProgressLabel,
  });
  const [expanded, setExpanded] = useState(agent.status === "running");

  const rowClassName = cn(
    EVENT_ROW_BASE_CLASSES,
    "flex w-full items-center gap-2 text-left text-sm transition-colors",
    hasTools && "cursor-pointer duration-150 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  const rowContent = (
    <>
        <AgentStatusIcon
          status={agent.status}
          label={t(AGENT_STATUS_LABEL_KEY[agent.status] ?? "a11y.agentStatusRunning")}
        />
        <GitFork className="h-4 w-4 shrink-0 text-text-subtle" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground" title={agent.agentId}>
            {agent.description.includes(" → ") ? (
              <>
                {agentLabel}
                <ArrowRightLeft className="mx-1 inline h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {agent.description.split(" → ").slice(1).join(" → ")}
              </>
            ) : (
              agentLabel
            )}
          </span>
        </div>
        {hasTools && (
          <span className={cn(EVENT_META_BADGE_CLASSES, "font-mono tabular-nums text-text-subtle")}>
            {completedToolCount}/{totalToolCount}
          </span>
        )}
        {hasTools && (
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </motion.span>
        )}
    </>
  );

  return (
    <div>
      {hasTools ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={
            expanded
              ? collapseAgentToolsLabel === "a11y.collapseAgentTools"
                ? `${t("a11y.collapse")} ${agentLabel}: ${agentToolProgressLabel}`
                : collapseAgentToolsLabel
              : expandAgentToolsLabel === "a11y.expandAgentTools"
                ? `${t("a11y.expand")} ${agentLabel}: ${agentToolProgressLabel}`
                : expandAgentToolsLabel
          }
          aria-expanded={expanded}
          className={rowClassName}
        >
          {rowContent}
        </button>
      ) : (
        <div className={rowClassName}>
          {rowContent}
        </div>
      )}

      {hasSummary && (
        <div className={cn("ml-1.5 mt-1.5", EVENT_LEFT_RAIL_CLASSES)}>
          <div className="grid gap-2 rounded-lg bg-muted px-2.5 py-2 sm:grid-cols-[5rem_1fr]">
            <span className="text-micro font-medium text-text-subtle">
              {t("computer.agentSummary")}
            </span>
            <MarkdownRenderer
              content={agent.summary ?? ""}
              className={cn("min-w-0", PROSE_CLASSES, TOOL_OUTPUT_MARKDOWN_CLASSES)}
              compactCode
            />
          </div>
        </div>
      )}

      {/* Nested tool calls */}
      <AnimatePresence initial={false}>
        {expanded && hasTools && (
          <motion.div
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className={cn("ml-1.5 mt-1.5 space-y-2", EVENT_LEFT_RAIL_CLASSES)}>
              {toolCalls.map((tc) => {
                if (SKILL_TOOL_NAMES.has(tc.name)) {
                  return <SkillActivityEntry key={tc.id} toolCall={tc} />;
                }
                const visual = getToolCallVisualClasses(getToolCallTone(tc));
                return (
                  <div
                    key={tc.id}
                    className={cn(TOOLING_ACTIVITY_ROW_CLASSES, visual.row, visual.rowHover)}
                  >
                    <div className="flex items-start gap-2.5 text-sm">
                      <ToolStatusIcon
                        tc={tc}
                        label={
                          tc.success !== undefined
                            ? tc.success === false
                              ? t("a11y.toolFailed")
                              : t("a11y.toolSuccess")
                            : t("a11y.toolRunning")
                        }
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 leading-6",
                          tc.success === false ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {normalizeToolNameI18n(tc.name, t)}
                      </span>
                      {tc.success === undefined && (
                        <RunningBadge>{t("computer.running")}</RunningBadge>
                      )}
                    </div>
                    {Object.keys(tc.input).length > 0 && (
                      <div className="mb-0.5 mt-1">
                        <ToolArgsDisplay input={tc.input} compact />
                      </div>
                    )}
                    {tc.output !== undefined && (
                      <div className="mb-1 mt-1">
                        <ToolOutputRenderer
                          output={tc.output}
                          toolName={tc.name}
                          success={tc.success}
                          contentType={tc.contentType}
                          conversationId={conversationId ?? null}
                          artifactIds={tc.artifactIds}
                          browserMetadata={tc.browserMetadata}
                          computerUseMetadata={tc.computerUseMetadata}
                          agentNameMap={agentNameMap}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
