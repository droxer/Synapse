"use client";

import { useCallback } from "react";
import { Search, Settings } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/components/ui/tooltip";
import { useTranslation } from "@/i18n";

interface ChannelPageHeaderProps {
  channelsConfigured: boolean;
  conversationCount: number | null;
  onOpenSettings: () => void;
}

export function ChannelPageHeader({
  channelsConfigured,
  conversationCount,
  onOpenSettings,
}: ChannelPageHeaderProps) {
  const { t } = useTranslation();
  const handleOpenCommandPalette = useCallback(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  }, []);

  const showCount = channelsConfigured && conversationCount !== null && conversationCount > 0;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4">
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h1 className="min-w-0 truncate text-subtitle text-foreground">
          {t("channels.title")}
        </h1>
        {showCount && (
          <span className="inline-flex items-baseline gap-1 text-caption tabular-nums text-text-subtle">
            <span className="text-foreground font-medium">{conversationCount}</span>
          </span>
        )}
        {channelsConfigured && (
          <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-success/40 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            {t("channels.header.live")}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              aria-label={t("channels.header.channelSettings")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("channels.header.channelSettings")}</TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={handleOpenCommandPalette}
          aria-label={t("channels.header.search")}
          data-slot="search-pill"
          className="search-pill shrink-0 cursor-pointer outline-none hover:text-foreground hover:border-border focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">{t("channels.header.search")}</span>
          <kbd className="hidden rounded-full bg-background px-2 py-0.5 font-mono text-caption-bold text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}
