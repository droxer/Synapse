import * as React from "react"

import { cn } from "@/shared/lib/utils"

/** Keyboard shortcut hint — borderless tonal pill shared by the top bar and command palette. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 font-mono text-micro text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
