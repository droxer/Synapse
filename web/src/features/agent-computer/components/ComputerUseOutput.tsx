"use client";

import { useCallback, useState } from "react";
import { Monitor } from "lucide-react";
import { useTranslation } from "@/i18n";
import { ExpandToggle } from "@/shared/components/ui/expand-toggle";
import {
  OutputSurface,
  OutputSurfaceBody,
  OutputSurfaceHeader,
  OutputSurfaceInner,
} from "@/shared/components/ui/output-surface";
import { ArtifactScreenshotGallery } from "./ArtifactScreenshotGallery";
import {
  OUTPUT_COLLAPSE_THRESHOLD,
  OUTPUT_SCROLL_AREA_CLASSES,
} from "../lib/format-tools";
import type { ComputerUseMetadata } from "@/shared/types";
import type { TFn } from "@/shared/types/i18n";

const ELLIPSIS = "…";

function formatActionDescription(
  meta: ComputerUseMetadata | undefined,
  toolName: string,
  t: TFn,
): string {
  if (!meta?.action || toolName === "computer_screenshot") {
    return t("output.computer.screenshot");
  }

  const { action, x, y, text, endX, endY } = meta;
  const hasPoint = x != null && y != null;

  switch (action) {
    case "click":
    case "double_click":
    case "right_click":
    case "move":
      return hasPoint
        ? t(`output.computer.${action}`, { x, y })
        : actionLabel(action, t);
    case "type":
    case "key":
      return text ? t(`output.computer.${action}`, { text }) : actionLabel(action, t);
    case "scroll_up":
    case "scroll_down":
      return t(`output.computer.${action}`);
    case "drag":
      return hasPoint && endX != null && endY != null
        ? t("output.computer.drag", { x, y, endX, endY })
        : actionLabel(action, t);
    default:
      return actionLabel(action, t);
  }
}

/** Human-readable, translated action label for the header meta slot. */
function actionLabel(action: string | undefined, t: TFn): string {
  const key = `output.computer.action.${action ?? "screenshot"}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return (action ?? "screenshot").replace(/_/g, " ");
}

interface ComputerUseOutputProps {
  readonly output: string;
  readonly computerUseMetadata?: ComputerUseMetadata;
  readonly toolName: string;
  readonly conversationId?: string | null;
  readonly artifactIds?: string[];
}

export function ComputerUseOutput({
  output,
  computerUseMetadata,
  toolName,
  conversationId,
  artifactIds,
}: ComputerUseOutputProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const handleToggle = useCallback(() => setExpanded((prev) => !prev), []);

  const description = formatActionDescription(computerUseMetadata, toolName, t);
  const hasScreenshot = artifactIds && artifactIds.length > 0 && conversationId;
  const action = computerUseMetadata?.action;
  const isLong = output.length > OUTPUT_COLLAPSE_THRESHOLD;
  const displayText = isLong && !expanded ? output.slice(0, OUTPUT_COLLAPSE_THRESHOLD) : output;
  const hasOutputText = displayText.trim().length > 0;

  return (
    <OutputSurface>
      <OutputSurfaceHeader
        icon={<Monitor className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
        label={t("output.category.computer")}
        meta={actionLabel(action, t)}
      />

      <OutputSurfaceBody>
        {/* Action description */}
        <p className="mb-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>

        {/* Screenshot thumbnail */}
        {hasScreenshot && (
          <ArtifactScreenshotGallery
            conversationId={conversationId}
            artifactIds={artifactIds}
            alt={t("output.generatedImage")}
          />
        )}

        {!hasScreenshot && hasOutputText && (
          <OutputSurfaceInner className={OUTPUT_SCROLL_AREA_CLASSES}>
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
              {displayText}
              {isLong && !expanded && ELLIPSIS}
            </pre>
          </OutputSurfaceInner>
        )}

        {!hasScreenshot && !hasOutputText && (
          <p className="text-sm text-muted-foreground">{t("conversation.waiting")}</p>
        )}

        {!hasScreenshot && isLong && (
          <ExpandToggle expanded={expanded} onToggle={handleToggle} />
        )}
      </OutputSurfaceBody>
    </OutputSurface>
  );
}

export { formatActionDescription };
