"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/shared/components/Logo";
import { PulsingDot } from "@/shared/components/PulsingDot";
import { Plus, PanelLeftClose, PanelLeftOpen, Trash2, Blocks, FolderOpen, Lightbulb, Radio, GitFork, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
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
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "@/i18n";
import type { ConversationHistoryItem } from "@/shared/stores";
import { ALL_TASKS_PATH, getSidebarRecentTasks } from "./sidebar-recent-tasks";

interface SidebarProps {
  taskHistory: readonly ConversationHistoryItem[];
  /** Server-side task count; used to decide whether to show the "View all" link. */
  totalTasks?: number;
  activeTaskId?: string | null;
  onNewTask: () => void;
  onSelectTask?: (taskId: string) => void;
  onNavigate?: (href: string) => void;
  collapsed?: boolean;
  width?: number;
  onToggle?: () => void;
  onWidthChange?: (width: number) => void;
  onDeleteTask?: (taskId: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
  activePath?: string;
  userMenu?: React.ReactNode;
}

const NAV_FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const NAV_ITEMS = [
  { href: "/library", labelKey: "sidebar.library", icon: FolderOpen },
  { href: "/channels", labelKey: "sidebar.channels", icon: Radio },
  { href: "/skills", labelKey: "sidebar.skills", icon: Lightbulb },
  { href: "/mcp", labelKey: "sidebar.mcp", icon: Blocks },
] as const;

/** Keyboard resize step (px) for the sidebar resize handle. */
const RESIZE_STEP = 16;

export function Sidebar({
  taskHistory,
  totalTasks = 0,
  activeTaskId,
  onNewTask,
  onSelectTask,
  onNavigate,
  collapsed = false,
  width = 256,
  onToggle,
  onWidthChange,
  onDeleteTask,
  onClose,
  isMobile = false,
  activePath,
  userMenu,
}: SidebarProps) {
  const { t } = useTranslation();
  const isHomeActive = activePath === "/" && !activeTaskId;
  const [taskToDelete, setTaskToDelete] = useState<ConversationHistoryItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
    },
    [width],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      onWidthChange?.(dragStartWidth.current + delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onWidthChange]);

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP;
      onWidthChange?.(width + delta);
    },
    [onWidthChange, width],
  );

  const { visibleTasks, hasMore: hasMoreTasks } = getSidebarRecentTasks(taskHistory, totalTasks);
  const isAllTasksActive = activePath === ALL_TASKS_PATH;

  const handleConfirmDelete = useCallback(() => {
    if (taskToDelete && onDeleteTask) {
      onDeleteTask(taskToDelete.id);
    }
    setTaskToDelete(null);
  }, [taskToDelete, onDeleteTask]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setTaskToDelete(null);
  }, []);
  const createNavClickHandler = useCallback(
    (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (onNavigate) {
        e.preventDefault();
        onNavigate(href);
        return;
      }
      onClose?.();
    },
    [onClose, onNavigate],
  );

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col overflow-hidden bg-sidebar-bg",
        collapsed ? "w-12" : "",
        !collapsed && !isDragging && "transition-[width] duration-200 ease-in-out",
      )}
      style={collapsed ? undefined : { width }}
    >
      {/* Header: logo + collapse/expand toggle */}
      <div className={cn("relative flex items-center py-3.5", collapsed ? "flex-col gap-2 px-2" : "justify-between px-4")}>
        <div className="flex items-center gap-2">
          <Logo size={28} tone="auto" animated />
          {!collapsed && (
            <span className="brand-wordmark whitespace-nowrap">
              {t("sidebar.brand")}
            </span>
          )}
        </div>
        {onToggle && (
          collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-expanded={!collapsed} aria-label={t("sidebar.expand")} className="text-muted-foreground hover:bg-sidebar-hover hover:text-foreground">
                  <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("sidebar.expand")}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-expanded={!collapsed} aria-label={t("sidebar.collapse")} className="text-muted-foreground hover:bg-sidebar-hover hover:text-foreground">
                  <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("sidebar.collapse")}</TooltipContent>
            </Tooltip>
          )
        )}
      </div>

      {/* New task + grouped navigation */}
      <nav
        aria-label={t("a11y.navigation")}
        className={cn("relative space-y-1", collapsed ? "px-2 pb-2" : "px-4 pb-3")}
      >
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNewTask}
                aria-label={t("sidebar.newTask")}
                aria-current={isHomeActive ? "page" : undefined}
                className={cn(
                  "group/new flex w-full items-center justify-center rounded-md p-1.5",
                  "transition-[color,background-color] duration-200",
                  NAV_FOCUS_CLASS,
                  isHomeActive
                    ? "bg-sidebar-active text-foreground"
                    : "bg-sidebar-bg text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-foreground",
                )}
              >
                <Plus aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover/new:rotate-90" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("sidebar.newTask")}</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onNewTask}
            aria-current={isHomeActive ? "page" : undefined}
            className={cn(
              "group/new flex w-full items-center gap-2.5 rounded-md px-2 py-1.5",
              "transition-colors duration-200 ease-out",
              NAV_FOCUS_CLASS,
              isMobile && "min-h-11",
              isHomeActive
                ? "bg-sidebar-active text-foreground"
                : "text-foreground hover:bg-sidebar-hover",
            )}
          >
            <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-foreground transition-transform duration-200 group-hover/new:rotate-90" />
            <span className="text-body-sm-bold">{t("sidebar.newTask")}</span>
          </button>
        )}

        <div className={cn("space-y-1", collapsed ? "pt-2" : "pt-3")}>
          {NAV_ITEMS.map(({ href, labelKey, icon: NavIcon }) => {
            const isCurrent = activePath === href;
            const label = t(labelKey);
            if (collapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        "w-full",
                        isCurrent
                          ? "bg-sidebar-active text-foreground"
                          : "text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-foreground",
                      )}
                      asChild
                    >
                      <Link
                        href={href}
                        onClick={createNavClickHandler(href)}
                        aria-label={label}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        <NavIcon aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                onClick={createNavClickHandler(href)}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-body-sm-bold transition-colors duration-150",
                  NAV_FOCUS_CLASS,
                  isMobile && "min-h-11",
                  isCurrent
                    ? "bg-sidebar-active text-foreground"
                    : "text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-foreground",
                )}
              >
                <NavIcon
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-200",
                    isCurrent ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacing between nav actions and task list */}
      <div className={cn("h-2", collapsed ? "mx-2" : "mx-4")} />

      {/* Task list */}
      {!collapsed && (
        <div className="px-4 pb-1 pt-4">
          <span className="label-section whitespace-nowrap text-muted-foreground">
            {t("sidebar.recentTasks")}
          </span>
        </div>
      )}
      <div className={cn("relative min-h-0 flex-1 overflow-y-auto", collapsed ? "px-2" : "px-4 pt-0.5")}>
          <div className="space-y-1 pb-2">
            {!collapsed && taskHistory.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-text-subtle">
                {t("sidebar.noTasks")}
              </p>
            )}
            {visibleTasks.map((task) => {
              const isActive = task.id === activeTaskId;
              const isPlanner = task.orchestratorMode === "planner";
              const taskTooltip = isPlanner
                ? `${t("sidebar.planTask")} · ${task.title}`
                : task.title;
              return collapsed ? (
                <Tooltip key={task.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelectTask?.(task.id)}
                      aria-label={task.title}
                      className={cn(
                        "relative flex w-full cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors duration-200",
                        "hover:bg-sidebar-hover",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isActive && "bg-sidebar-active",
                      )}
                    >
                      {isPlanner ? (
                        <GitFork
                          className={cn(
                            "h-3.5 w-3.5 transition-colors duration-200",
                            isActive ? "text-ring" : "text-foreground",
                          )}
                        />
                      ) : (
                        <div className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200",
                          isActive ? "bg-ring" : "bg-border-strong",
                        )} />
                      )}
                      {task.isRunning && (
                        <span className="absolute right-1.5 top-1.5">
                          <PulsingDot size="sm" />
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{taskTooltip}</TooltipContent>
                </Tooltip>
              ) : (
                <div key={task.id} className="group relative">
                  <button
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => onSelectTask?.(task.id)}
                    className={cn(
                      "relative flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 pr-9 text-left",
                      "transition-colors duration-200 ease-out",
                      "hover:bg-sidebar-hover",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isMobile && "min-h-11",
                      isActive && "bg-sidebar-active",
                    )}
                  >
                    {task.isRunning && <PulsingDot size="sm" className="shrink-0" />}
                    <span
                      title={task.title}
                      className={cn(
                        "min-w-0 flex-1 truncate text-body-sm transition-colors duration-200",
                        isActive ? "font-bold text-foreground" : "text-sidebar-foreground-muted",
                        task.isRunning && !isActive && "text-foreground",
                      )}
                    >
                      {task.title}
                    </span>
                    {isPlanner && (
                      <span
                        title={t("sidebar.planTask")}
                        className={cn(
                          "status-pill shrink-0",
                          isActive
                            ? "status-primary"
                            : "status-ai",
                        )}
                      >
                        <GitFork className="h-3 w-3" />
                        <span>{t("topbar.plan")}</span>
                      </span>
                    )}
                  </button>
                  {onDeleteTask && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("sidebar.deleteTaskLabel", { title: task.title })}
                      onClick={() => setTaskToDelete(task)}
                      className={cn(
                        "fine-hover-action absolute right-1 top-1/2 -translate-y-1/2 shrink-0",
                        "text-text-subtle hover:text-destructive hover:bg-destructive/10",
                      )}
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
            {hasMoreTasks && (collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={ALL_TASKS_PATH}
                    onClick={createNavClickHandler(ALL_TASKS_PATH)}
                    aria-label={t("sidebar.viewAllTasks")}
                    aria-current={isAllTasksActive ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center justify-center rounded-md p-1.5 transition-colors duration-200",
                      NAV_FOCUS_CLASS,
                      isAllTasksActive
                        ? "bg-sidebar-active text-foreground"
                        : "text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-foreground",
                    )}
                  >
                    <MoreHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t("sidebar.viewAllTasks")}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                href={ALL_TASKS_PATH}
                onClick={createNavClickHandler(ALL_TASKS_PATH)}
                aria-current={isAllTasksActive ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-body-sm transition-colors duration-150",
                  NAV_FOCUS_CLASS,
                  isMobile && "min-h-11",
                  isAllTasksActive
                    ? "bg-sidebar-active text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground",
                )}
              >
                {t("sidebar.viewAllTasks")}
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
      </div>


      {/* Footer: user profile card (includes theme/language controls) */}
      <div
        className={cn(
          "shrink-0",
          collapsed
            ? "flex flex-col items-center gap-1 px-2 py-2"
            : "px-4 py-2.5",
        )}
      >
        {userMenu}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={taskToDelete !== null} onOpenChange={handleDialogOpenChange}>
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

      {/* Drag handle for resizing (hidden on mobile) */}
      {!collapsed && !isMobile && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("shared.sidebar.resize")}
          aria-valuenow={Math.round(width)}
          tabIndex={0}
          onMouseDown={handleDragStart}
          onKeyDown={handleResizeKeyDown}
          className={cn(
            "absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-border-strong/60 active:bg-border-strong",
            "focus-visible:outline-none focus-visible:bg-ring",
            isDragging && "bg-border-strong",
          )}
        />
      )}
    </aside>
  );
}
