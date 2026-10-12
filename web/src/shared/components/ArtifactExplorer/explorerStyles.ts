import { cn } from "@/shared/lib/utils";

export const EXPLORER_FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Borderless circular icon action — tonal fill; the icon inherits the button colour. */
export const FILE_ACTION_CLASS = cn(
  "touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-background/80 text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
  EXPLORER_FOCUS_CLASS,
);

/** Destructive variant of {@link FILE_ACTION_CLASS}. */
export const FILE_DELETE_ACTION_CLASS = cn(
  "touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-background/80 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
  EXPLORER_FOCUS_CLASS,
);
