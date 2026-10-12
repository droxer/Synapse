import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/**
 * Design-system button primitives — Linear-style: compact, sharp 4px radius, 13px / 500 labels.
 *
 * Variants:
 * - `default`: indigo primary fill (`bg-primary`). The one brand fill — use for the primary action.
 * - `secondary`: tonal surface (`bg-secondary`) with a hairline-free soft shadow. Secondary actions.
 * - `ghost`: transparent with tonal hover. Toolbar / low-emphasis actions.
 * - `destructive`: critical fill. Use for irreversible actions.
 * - `marketing`: ink fill (inverts in dark mode). Landing / login CTAs.
 * - `link`: indigo inline text link, no fill.
 *
 * Every CTA uses `rounded-sm` (4px) — icon sizes are sharp squares; `xs` drops to 2px.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap cursor-pointer",
    "rounded-sm text-button-md",
    "transition-[color,background-color,border-color,box-shadow,opacity] duration-100 ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-indigo-deep active:bg-indigo-selected",
        secondary: "bg-secondary text-foreground shadow-xs hover:bg-surface-hover",
        ghost: "bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground",
        destructive: "bg-critical text-on-destructive hover:bg-[color-mix(in_srgb,var(--color-critical),black_10%)] focus-visible:ring-destructive/40",
        marketing: "bg-ink-button text-on-ink-button hover:bg-[color-mix(in_srgb,var(--color-ink-button),var(--color-on-ink-button)_14%)]",
        link: "text-info underline-offset-4 hover:underline rounded-sm",
      },
      size: {
        default: "h-8 px-3 gap-1.5 has-[>svg]:px-2.5",
        sm: "h-7 px-2.5 gap-1.5 has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-6 px-2 text-caption-bold gap-1 rounded-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 px-4 has-[>svg]:px-3",
        tab: "h-7 px-2.5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
