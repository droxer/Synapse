import * as React from "react"

import { cn } from "@/shared/lib/utils"

/** Keyboard shortcut hint — Linear-style tonal keycap shared by the top bar and command palette. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm bg-surface-hover px-1 font-sans text-micro font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
