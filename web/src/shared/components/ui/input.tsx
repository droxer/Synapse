import * as React from "react"

import { cn } from "@/shared/lib/utils"

/**
 * DESIGN.md `text-input` — Linear-compact: 32px tall, `rounded-md`, 1px `input` border.
 * Focus → darker border + 3px indigo halo (matches Textarea / Select). Error → `destructive` border.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Box
        "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1",
        "text-body-sm text-foreground",
        "transition-[color,border-color,box-shadow] duration-100 outline-none",
        // Selection + file input
        "selection:bg-primary/20 selection:text-foreground",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // Placeholder
        "placeholder:text-placeholder",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Focus → border steps up + soft indigo halo (no layout shift)
        "focus-visible:border-border-active focus-visible:shadow-glow-subtle",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
