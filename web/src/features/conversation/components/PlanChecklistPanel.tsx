"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertCircle, Minus } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import type { PlanStep } from "@/shared/types";

interface PlanChecklistPanelProps {
  readonly planSteps: readonly PlanStep[];
}

function StepIndicator({ status }: { readonly status: PlanStep["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-success/15 flex-shrink-0">
        <Check className="h-2.5 w-2.5 text-success-text" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-muted flex-shrink-0">
        <Minus className="h-2.5 w-2.5 text-muted-foreground" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-destructive/10 flex-shrink-0">
        <X className="h-2.5 w-2.5 text-destructive" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (status === "replan_required") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-warning/15 flex-shrink-0">
        <AlertCircle className="h-2.5 w-2.5 text-warning-text" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-4 w-4 items-center justify-center flex-shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulsing-dot-fade" />
      </span>
    );
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center flex-shrink-0">
      <span className="h-1 w-1 rounded-full bg-border-strong" />
    </span>
  );
}

type TFn = (key: string, params?: Record<string, string | number>) => string;

const STATUS_LABEL_KEYS: Partial<Record<PlanStep["status"], string>> = {
  pending: "plan.statusPending",
  running: "plan.statusRunning",
  complete: "plan.statusComplete",
  error: "plan.statusError",
  skipped: "plan.statusSkipped",
  replan_required: "plan.statusReplanRequired",
};

function getLocalizedStepName(step: PlanStep, t: TFn): string {
  return step.nameI18nKey ? t(step.nameI18nKey) : step.name;
}

function getLocalizedStepDescription(step: PlanStep, t: TFn): string {
  return step.descriptionI18nKey ? t(step.descriptionI18nKey) : step.description;
}

function StepRow({ step, index, t }: { readonly step: PlanStep; readonly index: number; readonly t: TFn }) {
  const isComplete = step.status === "complete";
  const isSkipped = step.status === "skipped";
  const isError = step.status === "error";
  const isReplanRequired = step.status === "replan_required";
  const isRunning = step.status === "running";
  const name = getLocalizedStepName(step, t);
  const description = getLocalizedStepDescription(step, t);

  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.14, ease: "easeOut", delay: index * 0.03 }}
      className={cn(
        "group relative flex items-start gap-2.5 px-3 py-2 rounded-md transition-colors",
        isRunning && "bg-primary/[0.04]",
        isSkipped && "opacity-70",
        !isRunning && !isComplete && !isSkipped && !isError && !isReplanRequired && "opacity-60",
      )}
    >
      {/* Left status bar */}
      <span
        className={cn(
          "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full transition-colors",
          isComplete && "bg-success",
          isSkipped && "bg-border-strong",
          isError && "bg-destructive",
          isReplanRequired && "bg-warning",
          isRunning && "bg-primary",
          !isRunning && !isComplete && !isSkipped && !isError && !isReplanRequired && "bg-border",
        )}
      />

      <StepIndicator status={step.status} />
      <span className="sr-only">{t(STATUS_LABEL_KEYS[step.status] ?? "plan.statusPending")}: </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-body-sm break-words",
            isComplete && "text-muted-foreground line-through decoration-muted-foreground/40",
            isSkipped && "text-muted-foreground",
            isError && "text-destructive",
            isReplanRequired && "text-warning-text",
            isRunning && "text-body-sm-bold text-foreground",
            !isRunning && !isComplete && !isSkipped && !isError && !isReplanRequired && "text-muted-foreground",
          )}
        >
          {name}
        </p>
        {description && !isComplete && !isSkipped && (
          <p className="mt-0.5 text-caption text-text-subtle line-clamp-2 break-words">
            {description}
          </p>
        )}
        {isRunning && (
          <div className="mt-1.5 h-0.5 w-full rounded-full overflow-hidden bg-primary/10" aria-hidden="true">
            <motion.div
              className="h-full bg-primary/60 rounded-full"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        )}
      </div>

      {(isError || isReplanRequired) && (
        <span className="flex-shrink-0 mt-0.5">
          <AlertCircle className={cn("h-3 w-3", isError ? "text-destructive" : "text-warning-text")} aria-hidden="true" />
        </span>
      )}
    </motion.li>
  );
}

export function PlanChecklistPanel({ planSteps }: PlanChecklistPanelProps) {
  const { t } = useTranslation();

  if (planSteps.length === 0) {
    return null;
  }

  const resolvedCount = planSteps.filter((s) => s.status === "complete" || s.status === "skipped").length;
  const hasError = planSteps.some((s) => s.status === "error" || s.status === "replan_required");
  const progressPct = Math.round((resolvedCount / planSteps.length) * 100);

  return (
    <div className="overflow-hidden rounded-xl bg-muted/30">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="label-mono text-muted-foreground flex-1">
          {t("plan.title")}
        </span>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-label={t("plan.title")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
          className="flex-1 max-w-[5rem] h-1 rounded-full bg-muted overflow-hidden"
        >
          <motion.div
            className={cn(
              "h-full w-full origin-left rounded-full transition-colors",
              hasError ? "bg-warning" : "bg-success",
            )}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progressPct / 100 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>

        <Badge
          variant={
            hasError
              ? "warning"
              : resolvedCount === planSteps.length
                ? "success"
                : "neutral"
          }
          className="tabular-nums"
        >
          {t("plan.progress", { completed: resolvedCount, total: planSteps.length })}
        </Badge>
      </div>

      {/* Steps */}
      <ul className="py-1">
        <AnimatePresence initial={false}>
          {planSteps.map((step, i) => (
            <StepRow key={`${step.nameI18nKey ?? step.name}-${i}`} step={step} index={i} t={t} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
