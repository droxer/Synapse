"use client";

import { BellRing, Clock3, Radar } from "lucide-react";
import { formatClockTime } from "@/shared/lib/date-time";
import { Badge } from "@/shared/components/ui/badge";
import type { Locale } from "@/i18n/types";
import type { ThreadTask } from "../lib/background-tasks";

interface ThreadTasksPanelProps {
  readonly tasks: readonly ThreadTask[];
  readonly locale: Locale;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

function getStatusBadgeVariant(status: ThreadTask["status"]): "info" | "neutral" {
  return status === "running" ? "info" : "neutral";
}

function getStatusLabel(
  status: ThreadTask["status"],
  t: ThreadTasksPanelProps["t"],
): string {
  switch (status) {
    case "running":
      return t("threadTasks.statusRunning");
    case "scheduled":
    default:
      return t("threadTasks.statusScheduled");
  }
}

export function ThreadTasksPanel({
  tasks,
  locale,
  t,
}: ThreadTasksPanelProps) {
  if (tasks.length === 0) return null;

  return (
    <section
      aria-label={t("threadTasks.title")}
      className="shrink-0"
    >
      <div className="px-3 py-3">
        <div className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-circle bg-muted text-muted-foreground">
              <Radar className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-body-sm-bold text-foreground">
                  {t("threadTasks.title")}
                </h2>
                <Badge variant="neutral" className="tabular-nums">
                  {tasks.length}
                </Badge>
              </div>
              <p className="mt-0.5 text-micro text-text-subtle">
                {t("threadTasks.subtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {tasks.map((task) => (
            <article
              key={task.taskId}
              className="rounded-xl bg-muted/40 px-3 py-3"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(task.status)}>
                      {getStatusLabel(task.status, t)}
                    </Badge>
                    <span className="label-mono text-text-subtle">
                      {t("threadTasks.scope")}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-body-sm-bold text-foreground" title={task.title}>
                    {task.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 break-words text-body-sm text-muted-foreground">
                    {task.message || t("threadTasks.fallbackMessage")}
                  </p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-circle bg-muted text-muted-foreground">
                  {task.status === "running" ? (
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
              </div>

              {task.scheduledFor && (
                <div className="mt-3 text-right">
                  <span className="text-caption tabular-nums text-muted-foreground">
                    {t("threadTasks.dueAt", {
                      time: formatClockTime(task.scheduledFor, locale),
                    })}
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
