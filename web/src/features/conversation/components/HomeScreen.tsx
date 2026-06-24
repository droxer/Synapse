"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Zap, Sparkles, CircleDot } from "lucide-react";
import { ChatInput } from "./ChatInput";
import { SuggestionPill } from "./SuggestionPill";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { useTranslation } from "@/i18n";

interface HomeScreenProps {
  onSubmitTask: (task: string, files?: File[], skills?: string[], usePlanner?: boolean) => void;
  error?: string | null;
  isLoading?: boolean;
}

const SUGGESTION_ICONS = [
  <Zap key="zap" className="h-4 w-4" aria-hidden="true" />,
  <Sparkles key="sparkles" className="h-4 w-4" aria-hidden="true" />,
  <CircleDot key="circle" className="h-4 w-4" aria-hidden="true" />,
];

export function HomeScreen({ onSubmitTask, error, isLoading = false }: HomeScreenProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<{ id: number; text: string } | null>(null);
  const [composerHasContent, setComposerHasContent] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState("");

  const suggestions = [
    {
      label: t("welcome.suggestion.prototype"),
      prompt: t("welcome.suggestion.prototypePrompt"),
    },
    {
      label: t("welcome.suggestion.improve"),
      prompt: t("welcome.suggestion.improvePrompt"),
    },
    {
      label: t("welcome.suggestion.planBuild"),
      prompt: t("welcome.suggestion.planBuildPrompt"),
    },
  ];

  useEffect(() => {
    if (error) setDismissed(false);
  }, [error]);

  const showError = error && !dismissed;
  const showSuggestions = !composerHasContent;

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <div className="relative flex h-full w-full flex-col justify-center overflow-hidden px-4 sm:px-6">
      {/* Decorative background layer */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-hairline) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 top-20 h-64 w-64 rotate-12 rounded-[40px] border border-cobalt/10 bg-cobalt/[0.04]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-16 bottom-24 h-36 w-36 -rotate-6 rounded-3xl border border-cobalt/[0.08] bg-cobalt/[0.04]"
        aria-hidden="true"
      />

      <motion.div
        className="relative z-10 mx-auto w-full max-w-[680px]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.p
          variants={itemVariants}
          className="text-xs font-semibold uppercase tracking-[0.08em] text-steel"
        >
          {t("sidebar.brand")}
        </motion.p>

        <motion.h1
          variants={itemVariants}
          className="mt-4 text-left text-[32px] font-medium leading-[1.12] tracking-[-0.02em] text-ink-deep sm:text-[36px] lg:text-[42px]"
        >
          {t("welcome.heading")}
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-4 max-w-[440px] text-left text-body-md text-steel"
        >
          {t("welcome.subtitle")}
        </motion.p>

        <motion.div variants={itemVariants} className="mt-10">
          <ChatInput
            onSendMessage={onSubmitTask}
            variant="welcome"
            disabled={isLoading}
            isAgentRunning={isLoading}
            draftMessage={draftPrompt}
            onContentStateChange={setComposerHasContent}
          />
        </motion.div>

        <AnimatePresence initial={false}>
          {showSuggestions && (
            <motion.section
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
              className="mt-7 flex flex-wrap gap-3"
              role="group"
              aria-labelledby="welcome-suggestions-heading"
            >
              <h2 id="welcome-suggestions-heading" className="sr-only">
                {t("welcome.suggestionsLabel")}
              </h2>
              {suggestions.map((suggestion, index) => (
                <SuggestionPill
                  key={suggestion.label}
                  label={suggestion.label}
                  icon={SUGGESTION_ICONS[index]}
                  disabled={isLoading}
                  aria-label={`${suggestion.label}: ${t("welcome.suggestion.actionHint")}`}
                  onClick={() => {
                    setDraftPrompt((current) => ({
                      id: (current?.id ?? 0) + 1,
                      text: suggestion.prompt,
                    }));
                    setComposerHasContent(true);
                    setSuggestionStatus(t("welcome.suggestion.addedStatus", { label: suggestion.label }));
                  }}
                />
              ))}
            </motion.section>
          )}
        </AnimatePresence>

        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {suggestionStatus}
        </div>

        <AnimatePresence>
          {showError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="mt-4 w-full"
            >
              <ErrorBanner message={error} onDismiss={() => setDismissed(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
