import * as React from "react"

import { cn } from "@/shared/lib/utils"

/**
 * DESIGN.md `text-input` — 44px tall, `rounded-lg`, 1px `input` border.
 * Focus → 2px `ring` border (matches Textarea / Select). Error → `destructive` border.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Box
        "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2",
        "text-body-md text-foreground",
        "transition-[color,border-color,box-shadow] outline-none",
        // Selection + file input
        "selection:bg-primary/20 selection:text-foreground",
        "file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-foreground",
        // Placeholder
        "placeholder:text-placeholder",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Focus → 2px ring border; padding shrinks 1px to avoid layout shift
        "focus-visible:border-2 focus-visible:border-ring focus-visible:px-[11px]",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
