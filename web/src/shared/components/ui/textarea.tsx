import * as React from "react"

import { cn } from "@/shared/lib/utils"

/** DESIGN.md text-input contract — matches Input primitive styling. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-background px-2.5 py-2",
        "text-body-sm text-foreground transition-[color,border-color,box-shadow] duration-100 outline-none",
        "placeholder:text-placeholder",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-border-active focus-visible:shadow-glow-subtle focus-visible:outline-none",
        "aria-invalid:border-destructive aria-invalid:ring-0",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
