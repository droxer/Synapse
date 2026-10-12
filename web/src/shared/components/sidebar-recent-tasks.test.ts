import { describe, expect, it } from "@jest/globals";
import {
  SIDEBAR_RECENT_TASK_LIMIT,
  getSidebarRecentTasks,
} from "./sidebar-recent-tasks";

const makeTasks = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `t${i}` }));

describe("getSidebarRecentTasks", () => {
  it("limits the sidebar to the 10 most recent tasks", () => {
    const { visibleTasks } = getSidebarRecentTasks(makeTasks(25), 25);

    expect(SIDEBAR_RECENT_TASK_LIMIT).toBe(10);
    expect(visibleTasks.map((t) => t.id)).toEqual(
      makeTasks(10).map((t) => t.id),
    );
  });

  it("shows the view-all link when the server has more tasks than the limit", () => {
    expect(getSidebarRecentTasks(makeTasks(10), 42).hasMore).toBe(true);
  });

  it("shows the view-all link when more tasks are loaded than the limit", () => {
    expect(getSidebarRecentTasks(makeTasks(11), 0).hasMore).toBe(true);
  });

  it("hides the view-all link when every task fits", () => {
    const { visibleTasks, hasMore } = getSidebarRecentTasks(makeTasks(10), 10);

    expect(visibleTasks).toHaveLength(10);
    expect(hasMore).toBe(false);
  });
});
