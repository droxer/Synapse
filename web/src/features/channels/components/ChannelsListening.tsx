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
    <div className="relative h-full w-full min-w-0 overflow-hidden bg-canvas">
      {/* Atmosphere: faint radial wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_60%_50%_at_50%_42%,rgba(16,185,129,0.06),transparent_70%)]"
      />
      {/* Concentric rings centered behind the icon */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[420px] max-w-[80vw] max-h-[80vh] -translate-x-1/2 -translate-y-1/2"
        >
          <span className="absolute inset-0 rounded-full border border-hairline-soft/70" />
          <span className="absolute inset-[14%] rounded-full border border-hairline-soft/50" />
          <span className="absolute inset-[28%] rounded-full border border-hairline-soft/30" />
        </div>
      </div>

      {/* Centered content via absolute positioning — avoids flex/grid intrinsic-size collapse on CJK text */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-8 py-10">
          <motion.div
            variants={channelsFadeIn}
            initial="hidden"
            animate="show"
            style={{ width: "28rem", maxWidth: "100%" }}
            className="relative z-10 text-center"
          >
            <div className="mx-auto mb-6 relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-2xl bg-accent-emerald/10 animate-ping [animation-duration:2.4s]" />
              <span className="absolute inset-[10%] rounded-2xl bg-accent-emerald/5 animate-ping [animation-duration:2.4s] [animation-delay:0.6s]" />
              <div className="relative flex h-14 w-24 items-center justify-center gap-2 rounded-2xl border border-hairline-soft bg-card shadow-sm">
                <ChannelProviderIcon provider="telegram" size="lg" />
                <ChannelProviderIcon provider="discord" size="lg" />
              </div>
            </div>

            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-hairline-soft bg-card/80 px-3 py-1 backdrop-blur-sm">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-accent-emerald/50 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-emerald" />
              </span>
              <span className="text-caption-bold uppercase tracking-wider text-accent-emerald">
                {t("channels.header.live")}
              </span>
            </div>

            <h3 className="mt-3 text-subtitle-lg text-ink-deep">
              {t("channels.listening.activeTitle")}
            </h3>
            <p className="mt-1.5 text-body-sm text-steel">
              {t("channels.listening.activeDescription")}
            </p>

            <div className="mt-6 grid w-full gap-3">
              {providers.map((item) => (
                <button
                  key={item.provider}
                  type="button"
                  onClick={item.onOpen}
                  className="w-full rounded-xl border border-hairline-soft bg-card/80 p-4 text-left backdrop-blur-sm transition-colors hover:border-hairline hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <ChannelProviderIcon provider={item.provider} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm-bold text-ink-deep">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-caption text-steel">
                        {item.hint}{" "}
                        <code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-caption text-ink-deep">
                          {item.command}
                        </code>
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              <div className="rounded-xl border border-hairline-soft bg-surface-soft/70 px-4 py-3 text-caption text-steel">
                {t("channels.listening.manageHint")}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
