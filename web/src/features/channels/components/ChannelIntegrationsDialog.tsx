"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { getChannelStatus, type ChannelProviderStatus } from "../api/channel-api";
import { ChannelProviderIcon, getProviderColor } from "./ChannelProviderIcon";

interface ChannelIntegrationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTelegram: () => void;
  onOpenDiscord: () => void;
}

type ProviderKey = "telegram" | "discord";

function ProviderTile({
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
  const brand = getProviderColor(provider);

  const stateLabel = linked
    ? t("channels.integrations.linked")
    : configured
      ? t("channels.integrations.configured")
      : t("channels.integrations.notConfigured");
  const actionLabel = configured
    ? t("channels.integrations.manage")
    : t("channels.integrations.configure");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 text-left transition-[border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{
        ["--tile-brand" as string]: brand,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${brand}80, transparent)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
        style={{ background: `${brand}26` }}
      />

      <div className="flex items-center justify-between">
        <ChannelProviderIcon provider={provider} size="lg" className="rounded-xl ring-1 ring-border" />
        {(configured || linked) && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-micro font-medium uppercase text-muted-foreground"
            title={stateLabel}
          >
            <Check className="h-3 w-3" style={{ color: brand }} />
            {stateLabel}
          </span>
        )}
        {!configured && !linked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-micro font-medium uppercase text-warning ring-1 ring-warning/25">
            <span className="h-1 w-1 rounded-full bg-warning" />
            {stateLabel}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-subtitle-lg text-foreground tracking-tight">
          {t(`channels.${provider}.title`)}
        </p>
        <p className="text-caption text-muted-foreground leading-snug">
          {t(`channels.integrations.${provider}ValueProp`)}
        </p>
      </div>

      {status?.bot_username && (
        <p className="-mt-1 truncate text-caption text-text-subtle font-mono">
          {provider === "telegram" ? "@" : ""}
          {status.bot_username.replace(/^@/, "")}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between pt-2">
        <span
          className="inline-flex items-center gap-1 text-caption-bold transition-colors"
          style={{ color: brand }}
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

function ProviderTileSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-xl skeleton-shimmer" />
        <div className="h-5 w-20 rounded-full skeleton-shimmer" />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-24 skeleton-shimmer rounded" />
        <div className="h-3 w-full skeleton-shimmer rounded" />
        <div className="h-3 w-3/4 skeleton-shimmer rounded" />
      </div>
      <div className="h-3 w-16 skeleton-shimmer rounded" />
    </div>
  );
}

export function ChannelIntegrationsDialog({
  open,
  onOpenChange,
  onOpenTelegram,
  onOpenDiscord,
}: ChannelIntegrationsDialogProps) {
  const { t } = useTranslation();
  const [telegramStatus, setTelegramStatus] = useState<ChannelProviderStatus | null>(null);
  const [discordStatus, setDiscordStatus] = useState<ChannelProviderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!open) return;
    try {
      setLoading(true);
      setError(null);
      const status = await getChannelStatus();
      setTelegramStatus(status.providers.telegram ?? null);
      setDiscordStatus(status.providers.discord ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.integrations.errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [open, t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const openProvider = (provider: ProviderKey) => {
    onOpenChange(false);
    if (provider === "telegram") {
      onOpenTelegram();
      return;
    }
    onOpenDiscord();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[34rem]">
        <DialogHeader>
          <DialogTitle>{t("channels.integrations.title")}</DialogTitle>
          <DialogDescription>
            {t("channels.integrations.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-body-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {loading ? (
              <>
                <ProviderTileSkeleton />
                <ProviderTileSkeleton />
              </>
            ) : (
              <>
                <ProviderTile
                  provider="telegram"
                  status={telegramStatus}
                  onOpen={() => openProvider("telegram")}
                />
                <ProviderTile
                  provider="discord"
                  status={discordStatus}
                  onOpen={() => openProvider("discord")}
                />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
