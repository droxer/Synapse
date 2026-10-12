"use client";

import { startTransition, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { GitFork, ListTodo, Trash2 } from "lucide-react";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { ProductPageHeader, ProductSectionHeader } from "@/shared/components/ProductPage";
import { PulsingDot } from "@/shared/components/PulsingDot";
import { SearchInput } from "@/shared/components/SearchInput";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useAppStore, type ConversationHistoryItem } from "@/shared/stores";
import { getConversationPath } from "@/features/conversation/lib/routes";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "@/i18n";
import { useAllTasks } from "../hooks/use-all-tasks";

const ROW_FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function formatTaskDate(timestamp: number, locale: string): string {
  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function TaskListSkeleton() {
  return (
    <div className="space-y-1" role="status" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-11 rounded-md skeleton-shimmer" />
      ))}
    </div>
  );
}

interface TaskRowProps {
  readonly task: ConversationHistoryItem;
  readonly isActive: boolean;
  readonly locale: string;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (task: ConversationHistoryItem) => void;
}

function TaskRow({ task, isActive, locale, onSelect, onDelete }: TaskRowProps) {
  const { t } = useTranslation();
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onSelect(task.id)}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 pr-12 text-left transition-colors duration-150",
          "hover:bg-muted",
          ROW_FOCUS_CLASS,
          isActive && "bg-muted",
        )}
      >
        {task.isRunning && <PulsingDot size="sm" className="shrink-0" />}
        <span
          title={task.title}
          className={cn(
            "min-w-0 flex-1 truncate text-body-sm text-foreground",
            isActive && "font-bold",
          )}
        >
          {task.title}
        </span>
        {task.orchestratorMode === "planner" && (
          <span title={t("sidebar.planTask")} className="status-pill status-ai shrink-0">
            <GitFork aria-hidden="true" className="h-3 w-3" />
            <span>{t("topbar.plan")}</span>
          </span>
        )}
        <time
          dateTime={new Date(task.timestamp).toISOString()}
          className="shrink-0 text-caption tabular-nums text-muted-foreground"
        >
          {formatTaskDate(task.timestamp, locale)}
        </time>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("sidebar.deleteTaskLabel", { title: task.title })}
        onClick={() => onDelete(task)}
        className="fine-hover-action absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

export function TasksPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { tasks, total, isLoading, hasMore, error, query, setQuery, loadMore, removeTask } =
    useAllTasks();
  const activeTaskId = useAppStore((s) => s.conversationId);
  const switchConversation = useAppStore((s) => s.switchConversation);
  const clearPendingNewTask = useAppStore((s) => s.clearPendingNewTask);
  const clearPendingConversationRoute = useAppStore((s) => s.clearPendingConversationRoute);
  const deleteConversation = useAppStore((s) => s.deleteConversation);
  const [taskToDelete, setTaskToDelete] = useState<ConversationHistoryItem | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const handleSelect = useCallback(
    (id: string) => {
      clearPendingNewTask();
      clearPendingConversationRoute();
      switchConversation(id);
      startTransition(() => {
        router.push(getConversationPath(id));
      });
    },
    [clearPendingConversationRoute, clearPendingNewTask, router, switchConversation],
  );

  const handleConfirmDelete = useCallback(() => {
    if (taskToDelete) {
      removeTask(taskToDelete.id);
      void deleteConversation(taskToDelete.id);
    }
    setTaskToDelete(null);
  }, [deleteConversation, removeTask, taskToDelete]);

  const isSearching = query.trim().length > 0;
  const showSkeleton = isLoading && tasks.length === 0;
  const showError = error !== null && error !== dismissedError;

  return (
    <div className="flex h-full flex-col bg-background">
      <ProductPageHeader
        icon={<ListTodo aria-hidden="true" className="h-5 w-5 text-muted-foreground" />}
        eyebrow={t("tasks.eyebrow")}
        title={t("tasks.title")}
        description={
          total > 0 && !isSearching ? (
            <span className="tabular-nums">
              {t(total === 1 ? "tasks.countOne" : "tasks.countMany", { count: total })}
            </span>
          ) : (
            t("tasks.subtitle")
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5">
          {showError && (
            <ErrorBanner
              message={t("tasks.loadFailed")}
              onDismiss={() => setDismissedError(error)}
            />
          )}

          {(total > 0 || isSearching) && (
            <ProductSectionHeader
              actions={
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder={t("tasks.filterPlaceholder")}
                  clearLabel={t("tasks.clearFilter")}
                />
              }
            />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {showSkeleton ? (
              <TaskListSkeleton />
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={ListTodo}
                dashed
                title={isSearching ? t("tasks.noMatching") : t("sidebar.noTasks")}
                description={isSearching ? t("tasks.noMatchingHint") : t("tasks.emptyHint")}
              />
            ) : (
              <ul className="space-y-0.5">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isActive={task.id === activeTaskId}
                    locale={locale}
                    onSelect={handleSelect}
                    onDelete={setTaskToDelete}
                  />
                ))}
              </ul>
            )}

            {hasMore && tasks.length > 0 && (
              <div className="flex justify-center pt-4">
                <Button variant="secondary" size="sm" onClick={loadMore} disabled={isLoading}>
                  {t("tasks.loadMore")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={taskToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sidebar.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sidebar.deleteConfirmDesc", { title: taskToDelete?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("sidebar.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              {t("sidebar.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
