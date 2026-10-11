"use client";

import { motion } from "framer-motion";
import { ChannelProviderIcon } from "./ChannelProviderIcon";
import { useTranslation } from "@/i18n";
import { channelsFadeIn } from "../lib/motion";

interface ChannelsListeningProps {
  onOpenTelegram: () => void;
  onOpenDiscord: () => void;
}

export function ChannelsListening({ onOpenTelegram, onOpenDiscord }: ChannelsListeningProps) {
  const { t } = useTranslation();
  const providers = [
    {
      provider: "telegram",
      title: t("channels.listening.openTelegram"),
      hint: t("channels.listening.openTelegramHintPrefix"),
      command: "hello",
      onOpen: onOpenTelegram,
    },
    {
      provider: "discord",
      title: t("channels.listening.openDiscord"),
      hint: t("channels.listening.openDiscordHintPrefix"),
      command: "hello",
      onOpen: onOpenDiscord,
    },
  ] as const;

  return (
    <div className="relative h-full w-full min-w-0 overflow-hidden bg-background">
      {/* Atmosphere: faint radial wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_60%_50%_at_50%_42%,color-mix(in_srgb,var(--color-success)_6%,transparent),transparent_70%)]"
      />

      {/* Centered content via absolute positioning — avoids flex/grid intrinsic-size collapse on CJK text */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-8 py-10">
          <motion.div
            variants={channelsFadeIn}
            initial="hidden"
            animate="show"
            className="relative z-10 w-[28rem] max-w-full text-center"
          >
            <div className="mx-auto mb-6 relative flex h-20 w-20 items-center justify-center" aria-hidden="true">
              <span className="absolute inset-0 rounded-2xl bg-success/10 motion-safe:animate-ping [animation-duration:2.4s]" />
              <div className="relative flex h-14 w-24 items-center justify-center gap-2 rounded-2xl bg-surface-soft">
                <ChannelProviderIcon provider="telegram" size="lg" />
                <ChannelProviderIcon provider="discord" size="lg" />
              </div>
            </div>

            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-success-subtle px-3 py-1">
              <span className="relative inline-flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inset-0 rounded-full bg-success/50 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              <span className="text-caption-bold uppercase tracking-wider text-success-text">
                {t("channels.header.live")}
              </span>
            </div>

            <h2 className="mt-3 text-balance text-subtitle-lg text-foreground">
              {t("channels.listening.activeTitle")}
            </h2>
            <p className="mt-1.5 text-body-sm text-muted-foreground">
              {t("channels.listening.activeDescription")}
            </p>

            <div className="mt-6 grid w-full gap-3">
              {providers.map((item) => (
                <button
                  key={item.provider}
                  type="button"
                  onClick={item.onOpen}
                  className="w-full rounded-xl bg-surface-soft p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface-soft),var(--color-ink-deep)_4%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <ChannelProviderIcon provider={item.provider} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm-bold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        {item.hint}{" "}
                        <code className="rounded-sm bg-background px-1.5 py-0.5 font-mono text-caption text-foreground">
                          {item.command}
                        </code>
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              <p className="px-4 py-2 text-caption text-muted-foreground">
                {t("channels.listening.manageHint")}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
