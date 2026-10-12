"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { History, LayoutTemplate, ListChecks, WandSparkles } from "lucide-react";
import { ChatInput } from "./ChatInput";
import { SuggestionRow } from "./SuggestionRow";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { useTranslation } from "@/i18n";
import { cn } from "@/shared/lib/utils";
import type { LandingSuggestion } from "../hooks/use-landing-suggestions";

interface HomeScreenProps {
  onSubmitTask: (task: string, files?: File[], skills?: string[], usePlanner?: boolean) => void;
  error?: string | null;
  isLoading?: boolean;
  suggestions?: readonly LandingSuggestion[] | null;
}

const ICON_CLASS = "h-3.5 w-3.5";

const DEFAULT_SUGGESTION_ICONS = [
  <LayoutTemplate key="prototype" className={ICON_CLASS} aria-hidden="true" />,
  <WandSparkles key="improve" className={ICON_CLASS} aria-hidden="true" />,
  <ListChecks key="plan" className={ICON_CLASS} aria-hidden="true" />,
];

const RECENT_SUGGESTION_ICON = <History className={ICON_CLASS} aria-hidden="true" />;

export function HomeScreen({
  onSubmitTask,
  error,
  isLoading = false,
  suggestions: generatedSuggestions = null,
}: HomeScreenProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<{ id: number; text: string } | null>(null);
  const [composerHasContent, setComposerHasContent] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState("");

  const defaultSuggestions = [
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
  const hasGeneratedSuggestions = generatedSuggestions?.length === 3;
  const suggestions = hasGeneratedSuggestions ? generatedSuggestions : defaultSuggestions;
  const suggestionsLabel = hasGeneratedSuggestions
    ? t("welcome.suggestionsRecentLabel")
    : t("welcome.suggestionsLabel");

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
      <motion.div
        className="relative z-10 mx-auto w-full max-w-[640px] pb-[8vh]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          variants={itemVariants}
          className="text-balance text-left text-heading-md text-ink-deep sm:text-heading-lg"
        >
          {t("welcome.heading")}
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-2 max-w-[520px] text-left text-body-md text-steel"
        >
          {t("welcome.subtitle")}
        </motion.p>

        <motion.div variants={itemVariants} className="mt-6">
          <ChatInput
            onSendMessage={onSubmitTask}
            variant="welcome"
            disabled={isLoading}
            isAgentRunning={isLoading}
            draftMessage={draftPrompt}
            onContentStateChange={setComposerHasContent}
          />
        </motion.div>

        {/* Kept mounted while hidden so the centered composer doesn't jump when typing starts. */}
        <motion.div variants={itemVariants}>
          <section
            className={cn(
              "mt-8 transition-[opacity,visibility] duration-150 ease-out",
              !showSuggestions && "invisible opacity-0",
            )}
            aria-labelledby="welcome-suggestions-heading"
          >
            <h2 id="welcome-suggestions-heading" className="label-section px-2 text-stone">
              {suggestionsLabel}
            </h2>
            <ul className="mt-2 flex flex-col gap-0.5">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.label}>
                  <SuggestionRow
                    label={suggestion.label}
                    prompt={suggestion.prompt}
                    icon={hasGeneratedSuggestions ? RECENT_SUGGESTION_ICON : DEFAULT_SUGGESTION_ICONS[index]}
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
                </li>
              ))}
            </ul>
          </section>
        </motion.div>

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
