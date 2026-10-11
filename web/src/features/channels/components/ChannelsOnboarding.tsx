"use client";

import { motion } from "framer-motion";
import { ChannelProviderIcon } from "./ChannelProviderIcon";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "@/i18n";
import { channelsFadeIn } from "../lib/motion";

interface ChannelsOnboardingProps {
  onConfigureBot: () => void;
  onConfigureDiscord: () => void;
}

export function ChannelsOnboarding({ onConfigureBot, onConfigureDiscord }: ChannelsOnboardingProps) {
  const { t } = useTranslation();
  const steps = [
    { label: t("channels.onboarding.step1.label"), sub: t("channels.onboarding.step1.sub") },
    { label: t("channels.onboarding.step2.label"), sub: t("channels.onboarding.step2.sub") },
    { label: t("channels.onboarding.step3.label"), sub: t("channels.onboarding.step3.sub") },
  ] as const;

  return (
    <div className="flex h-full items-center justify-center bg-background px-8">
      <motion.div
        variants={channelsFadeIn}
        initial="hidden"
        animate="show"
        className="flex w-full max-w-sm flex-col items-center gap-7 text-center"
      >
        <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden="true">
          {/* Broadcast pulse — tonal discs, no outlines */}
          <span className="absolute inset-0 rounded-full bg-primary/[0.06] motion-safe:animate-ping [animation-duration:2.6s]" />
          <span className="absolute inset-0 rounded-full bg-surface-soft" />
          <span className="absolute inset-[18%] rounded-full bg-[color-mix(in_srgb,var(--color-surface-soft),var(--color-ink-deep)_4%)]" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <ChannelProviderIcon provider="telegram" size="lg" />
          </div>
        </div>

        <div className="flex w-full flex-col items-center space-y-1.5">
          <h2 className="w-full text-balance text-subtitle-lg text-foreground">{t("channels.onboarding.title")}</h2>
          <p className="w-full text-body-sm text-muted-foreground max-w-[18rem]">
            {t("channels.onboarding.description")}
          </p>
        </div>

        <ol className="w-full text-left">
          {steps.map((step, idx) => {
            const isActive = idx === 0;
            return (
              <li key={step.label} className="flex gap-3.5" aria-current={isActive ? "step" : undefined}>
                <div className="flex flex-col items-center">
                  <div
                    className={
                      isActive
                        ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-caption-bold text-primary-foreground"
                        : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption-bold text-muted-foreground"
                    }
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={`mt-1 w-0.5 flex-1 min-h-[20px] rounded-full ${
                        isActive ? "bg-primary/20" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <p
                    className={`text-body-sm-bold leading-tight ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`text-caption mt-0.5 ${
                      isActive ? "text-muted-foreground" : "text-text-subtle"
                    }`}
                  >
                    {step.sub}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <Button
          type="button"
          onClick={onConfigureBot}
          className="w-full gap-2"
        >
          <ChannelProviderIcon provider="telegram" size="sm" />
          <span>{t("channels.onboarding.cta")}</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onConfigureDiscord}
          className="w-full gap-2"
        >
          <ChannelProviderIcon provider="discord" size="sm" />
          <span>{t("channels.onboarding.discordCta")}</span>
        </Button>
      </motion.div>
    </div>
  );
}
