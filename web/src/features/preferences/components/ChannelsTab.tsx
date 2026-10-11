"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { RetryableError } from "./RetryableError";
import { getChannelStatus, type ChannelProviderStatus } from "@/features/channels/api/channel-api";
import { ChannelProviderIcon } from "@/features/channels/components/ChannelProviderIcon";
import { TabHeader } from "./TabHeader";

type ProviderKey = "telegram" | "discord";

function ChannelIntegrationRow({
  provider,
  status,
  onOpen,
}: {
  provider: ProviderKey;
  status: ChannelProviderStatus | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const configured = status?.configured ?? false;
  const linked = status?.linked ?? false;
  const statusVariant = linked ? "success" : configured ? "info" : "neutral";
  const statusLabel = linked
    ? t("channels.integrations.linked")
    : configured
      ? t("channels.integrations.configured")
      : t("channels.integrations.notConfigured");

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
      <ChannelProviderIcon provider={provider} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-body-sm-bold text-foreground">
            {t(`channels.${provider}.title`)}
          </p>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">
          {status?.bot_username ?? t(`channels.${provider}.description`)}
        </p>
      </div>
      <Button type="button" variant={configured ? "secondary" : "default"} size="sm" onClick={onOpen}>
        {configured ? t("channels.integrations.manage") : t("channels.integrations.configure")}
      </Button>
    </div>
  );
}

interface ChannelsTabProps {
  readonly onOpenTelegram: () => void;
  readonly onOpenDiscord: () => void;
}

export function ChannelsTab({ onOpenTelegram, onOpenDiscord }: ChannelsTabProps) {
  const { t } = useTranslation();
  const [telegramStatus, setTelegramStatus] = useState<ChannelProviderStatus | null>(null);
  const [discordStatus, setDiscordStatus] = useState<ChannelProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const status = await getChannelStatus();
      setTelegramStatus(status.providers.telegram ?? null);
      setDiscordStatus(status.providers.discord ?? null);
    } catch (err) {
      console.error("Failed to load channel status", err);
      setError(t("preferences.channels.errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  return (
    <section aria-labelledby="preferences-channels-title">
      <TabHeader
        eyebrow={t("preferences.channels.eyebrow")}
        title={t("preferences.channels.title")}
        description={t("preferences.channels.description")}
        titleId="preferences-channels-title"
      />

      {error && (
        <RetryableError
          className="mb-4"
          message={error}
          onRetry={() => void loadStatus()}
        />
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only" role="status">{t("preferences.loading")}</span>
          <div className="h-16 rounded-xl skeleton-shimmer" />
          <div className="h-16 rounded-xl skeleton-shimmer" />
        </div>
      ) : (
        <div className="space-y-3">
          <ChannelIntegrationRow
            provider="telegram"
            status={telegramStatus}
            onOpen={onOpenTelegram}
          />
          <ChannelIntegrationRow
            provider="discord"
            status={discordStatus}
            onOpen={onOpenDiscord}
          />
        </div>
      )}

      <div className="mt-5 flex items-start gap-2 px-1 text-caption text-muted-foreground">
        <MessageCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t("preferences.channels.help")}</p>
      </div>

    </section>
  );
}
