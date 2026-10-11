"use client";

import { useCallback, useMemo } from "react";
import { LayoutGrid, Search, Zap } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import { useConversationTokenUsage, formatTokenCount } from "@/shared/hooks/use-token-usage";
import type { TaskState } from "@/shared/types";
import { Kbd } from "@/shared/components/ui/kbd";
import { useModifierKeyLabel } from "@/shared/hooks/use-modifier-key-label";

interface TopBarProps {
  taskState: TaskState;
  isConnected: boolean;
  onNavigateHome?: () => void;
  conversationTitle?: string;
  conversationId?: string | null;
  orchestratorMode?: "agent" | "planner" | null;
  isPlannerAutoDetected?: boolean;
}

export function TopBar({
  taskState,
  isConnected: _isConnected,
  onNavigateHome,
  conversationTitle,
  conversationId,
  orchestratorMode,
  isPlannerAutoDetected = false,
}: TopBarProps) {
  const { t, locale } = useTranslation();
  const modifierKey = useModifierKeyLabel();
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const { usage: convUsage } = useConversationTokenUsage(conversationId ?? null);

  const handleOpenCommandPalette = useCallback(() => {
    document.dispatchEvent(new CustomEvent("synapse:open-command-palette"));
  }, []);

  const isActive = taskState !== "idle";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between bg-background px-6">
      {/* Left: Breadcrumb */}
      <div className="min-w-0 flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNavigateHome}
          aria-label={t("a11y.home")}
          className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        </Button>
        {isActive && conversationTitle && (
          <>
            <span className="text-body-sm text-text-subtle" aria-hidden="true">/</span>
            <span className="min-w-0 truncate text-body-sm-bold text-foreground">
              {conversationTitle}
            </span>
            {convUsage && (convUsage.input_tokens > 0 || convUsage.output_tokens > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("shared.topbar.tokenUsage", {
                      count: numberFormat.format(convUsage.input_tokens + convUsage.output_tokens),
                    })}
                    className="chip-muted chip-sm ml-2 inline-flex shrink-0 cursor-default items-center gap-1 font-mono tabular-nums transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    {formatTokenCount(convUsage.input_tokens + convUsage.output_tokens)}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="font-mono text-micro tabular-nums">
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    <span className="text-muted-foreground">{t("topbar.tokensIn")}</span>
                    <span className="text-right">{numberFormat.format(convUsage.input_tokens)}</span>
                    <span className="text-muted-foreground">{t("topbar.tokensOut")}</span>
                    <span className="text-right">{numberFormat.format(convUsage.output_tokens)}</span>
                    <span className="text-muted-foreground">{t("topbar.requests")}</span>
                    <span className="text-right">{numberFormat.format(convUsage.request_count)}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        {orchestratorMode === "planner" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="status"
                aria-live="polite"
                className="status-pill status-neutral ml-1.5 shrink-0"
              >
                <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-ring" aria-hidden="true" />
                <span>{t("topbar.plan")}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isPlannerAutoDetected ? t("topbar.planAutoTooltip") : t("topbar.planTooltip")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Right: Command palette trigger — DESIGN.md `search-pill` */}
      <button
        type="button"
        onClick={handleOpenCommandPalette}
        aria-label={t("topbar.search")}
        data-slot="search-pill"
        className="search-pill shrink-0 cursor-pointer outline-none hover:bg-sidebar-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t("topbar.search")}</span>
        <Kbd className="hidden bg-background px-2 sm:inline-flex">{`${modifierKey}K`}</Kbd>
      </button>
    </header>
  );
}
