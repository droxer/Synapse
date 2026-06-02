"use client";

import { motion } from "framer-motion";
import { ChannelProviderIcon } from "./ChannelProviderIcon";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "@/i18n";
import { channelsFadeIn } from "../lib/motion";

interface ChannelsOnboardingProps {
  onConfigureBot: () => void;
}

export function ChannelsOnboarding({ onConfigureBot }: ChannelsOnboardingProps) {
  const { t } = useTranslation();
  const steps = [
    { label: t("channels.onboarding.step1.label"), sub: t("channels.onboarding.step1.sub") },
    { label: t("channels.onboarding.step2.label"), sub: t("channels.onboarding.step2.sub") },
    { label: t("channels.onboarding.step3.label"), sub: t("channels.onboarding.step3.sub") },
  ] as const;

  return (
    <div className="flex h-full items-center justify-center bg-canvas px-8 welcome-radial-bg">
      <motion.div
        variants={channelsFadeIn}
        initial="hidden"
        animate="show"
        className="flex w-full max-w-sm flex-col items-center gap-7 text-center"
      >
        <div className="relative flex h-28 w-28 items-center justify-center">
          {/* Broadcast pulse — symbolizes outgoing signal */}
          <span className="absolute inset-0 rounded-full border border-focus/30 animate-ping [animation-duration:2.6s]" />
          <span className="absolute inset-[14%] rounded-full border border-focus/20 animate-ping [animation-duration:2.6s] [animation-delay:0.7s]" />
          <span className="absolute inset-0 rounded-full border border-hairline-soft" />
          <span className="absolute inset-[18%] rounded-full border border-hairline" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-hairline-soft bg-surface-soft shadow-sm">
            <ChannelProviderIcon provider="telegram" size="lg" />
          </div>
        </div>

        <div className="flex w-full flex-col items-center space-y-1.5">
          <h2 className="w-full text-subtitle-lg text-ink-deep">{t("channels.onboarding.title")}</h2>
          <p className="w-full text-body-sm text-steel max-w-[18rem]">
            {t("channels.onboarding.description")}
          </p>
        </div>

        <div className="w-full text-left">
          {steps.map((step, idx) => {
            const isActive = idx === 0;
            return (
              <div key={step.label} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <div
                    className={
                      isActive
                        ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-focus bg-focus text-caption-bold text-on-cobalt"
                        : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-soft text-caption-bold text-stone/70 ring-1 ring-hairline-soft"
                    }
                  >
                    {idx + 1}
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`mt-1 w-px flex-1 min-h-[20px] ${
                        isActive ? "bg-focus/30" : "bg-hairline-soft/60"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <p
                    className={`text-body-sm-bold leading-tight ${
                      isActive ? "text-ink-deep" : "text-stone/80"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`text-caption mt-0.5 ${
                      isActive ? "text-steel" : "text-stone/60"
                    }`}
                  >
                    {step.sub}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          onClick={onConfigureBot}
          className="w-full gap-2"
        >
          <ChannelProviderIcon provider="telegram" size="sm" />
          <span>{t("channels.onboarding.cta")}</span>
        </Button>
      </motion.div>
    </div>
  );
}
