"use client";

import { TasksPage } from "@/features/tasks/components/TasksPage";
import { ErrorBoundary } from "@/shared/components";

export default function Page() {
  return (
    <ErrorBoundary>
      <TasksPage />
    </ErrorBoundary>
  );
}
