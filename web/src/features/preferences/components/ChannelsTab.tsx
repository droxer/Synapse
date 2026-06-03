"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Button } from "@/shared/components/ui/button";
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
  const statusLabel = linked
    ? t("channels.integrations.linked")
    : configured
      ? t("channels.integrations.configured")
      : t("channels.integrations.notConfigured");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline-soft bg-card p-3">
      <ChannelProviderIcon provider={provider} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-body-sm-bold text-ink-deep">
            {t(`channels.${provider}.title`)}
          </p>
          <span className="shrink-0 rounded-sm border border-hairline-soft bg-surface-soft px-1.5 py-0.5 text-micro font-medium uppercase text-steel">
            {statusLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-caption text-steel">
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
    try {
      setError(null);
      const status = await getChannelStatus();
      setTelegramStatus(status.providers.telegram ?? null);
      setDiscordStatus(status.providers.discord ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.integrations.errorLoad"));
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
        <div className="mb-4 rounded-md border border-critical-strong bg-critical-strong/5 px-3 py-2 text-body-sm text-critical">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-16 rounded-lg skeleton-shimmer" />
          <div className="h-16 rounded-lg skeleton-shimmer" />
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

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-hairline-soft bg-surface-soft p-3 text-caption text-steel">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t("preferences.channels.help")}</p>
      </div>

    </section>
  );
}
