import { cn } from "@/shared/lib/utils";

export const EXPLORER_FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Borderless sharp icon action — tonal fill; the icon inherits the button colour. */
export const FILE_ACTION_CLASS = cn(
  "touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-background text-muted-foreground transition-colors duration-100 hover:bg-surface-hover hover:text-foreground",
  EXPLORER_FOCUS_CLASS,
);

/** Destructive variant of {@link FILE_ACTION_CLASS}. */
export const FILE_DELETE_ACTION_CLASS = cn(
  "touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-background text-muted-foreground transition-colors duration-100 hover:bg-danger-subtle hover:text-destructive",
  EXPLORER_FOCUS_CLASS,
);
