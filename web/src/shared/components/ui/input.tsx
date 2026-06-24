import * as React from "react"

import { cn } from "@/shared/lib/utils"

/**
 * DESIGN.md `text-input` — 44px tall, `rounded-md`, 1px `input` border.
 * Focus → 2px teal ring (`ring`). Error → `destructive` border.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Box
        "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2",
        "text-body-md text-foreground",
        "transition-[color,border-color,box-shadow] outline-none",
        // Selection + file input
        "selection:bg-primary/20 selection:text-foreground",
        "file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-foreground",
        // Placeholder
        "placeholder:text-muted-foreground",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Focus → 2px teal ring (no layout shift)
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
