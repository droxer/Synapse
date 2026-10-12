/** Max tasks listed in the sidebar; the rest live on the /tasks page. */
export const SIDEBAR_RECENT_TASK_LIMIT = 10;

export const ALL_TASKS_PATH = "/tasks";

interface SidebarRecentTasks<T> {
  readonly visibleTasks: readonly T[];
  readonly hasMore: boolean;
}

export function getSidebarRecentTasks<T>(
  tasks: readonly T[],
  totalTasks: number,
): SidebarRecentTasks<T> {
  return {
    visibleTasks: tasks.slice(0, SIDEBAR_RECENT_TASK_LIMIT),
    hasMore: Math.max(tasks.length, totalTasks) > SIDEBAR_RECENT_TASK_LIMIT,
  };
}
