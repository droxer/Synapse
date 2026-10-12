"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [shortcutLabel, setShortcutLabel] = useState("⌘K");
  useEffect(() => {
    // Resolve after mount to avoid a hydration mismatch on non-Mac platforms.
    const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMac) setShortcutLabel("Ctrl K");
  }, []);
  const handleOpenCommandPalette = useCallback(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  }, []);

  const showCount = channelsConfigured && conversationCount !== null && conversationCount > 0;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 bg-background px-4">
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h1 className="min-w-0 truncate text-subtitle-lg text-foreground">
          {t("channels.title")}
        </h1>
        {showCount && (
          <span className="inline-flex items-baseline gap-1 text-caption-bold tabular-nums text-foreground">
            <span aria-hidden="true">{conversationCount}</span>
            <span className="sr-only">
              {t("channels.header.conversationCount", { count: conversationCount })}
            </span>
          </span>
        )}
        {channelsConfigured && (
          <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-success/40 motion-safe:animate-ping" aria-hidden="true" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
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
              size="icon-sm"
              onClick={onOpenSettings}
              aria-label={t("channels.header.channelSettings")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("channels.header.channelSettings")}</TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={handleOpenCommandPalette}
          aria-label={t("channels.header.search")}
          data-slot="search-pill"
          className="search-pill shrink-0 cursor-pointer outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t("channels.header.search")}</span>
          <kbd className="hidden rounded-sm bg-background px-1.5 py-0.5 font-mono text-caption-bold text-muted-foreground sm:inline" aria-hidden="true">
            {shortcutLabel}
          </kbd>
        </button>
      </div>
    </header>
  );
}
