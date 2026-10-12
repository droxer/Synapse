import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/**
 * Badge variants — compact 20px pills, caption-bold (12px / 510), Linear label style.
 *
 * - `neutral`: muted chip — default, general-purpose labels.
 * - `success`: green subtle tint — "In stock", "Verified".
 * - `warning`: amber subtle tint — "Almost gone", "Selling fast".
 * - `danger`: red subtle tint — "Out of stock", validation labels.
 * - `info`: blue subtle tint — informational notices.
 * - `accent`: indigo subtle tint — brand/feature highlights.
 * - `outline`: bordered chip — secondary labels, compat alias.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden",
    "h-5 rounded-full border border-transparent px-2",
    "text-caption-bold whitespace-nowrap",
    "transition-[color,box-shadow]",
    "[a&]:focus-visible:ring-2 [a&]:focus-visible:ring-ring/40 [a&]:focus-visible:ring-offset-2 [a&]:focus-visible:ring-offset-background",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-success-subtle text-success-text",
        warning: "bg-warning-subtle text-warning-text",
        danger: "bg-danger-subtle text-destructive",
        info: "bg-info-subtle text-info",
        accent: "bg-accent-subtle text-info",
        outline: "border border-border-strong text-muted-foreground [a&]:hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
