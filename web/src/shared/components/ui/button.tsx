import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/**
 * Design-system button primitives — teal `primary` is the only brand fill.
 *
 * Variants:
 * - `default`: teal primary fill (`bg-primary`), white foreground. Use for primary actions.
 * - `secondary`: subtle surface (`bg-secondary`) with a visible border. Use for secondary actions.
 * - `ghost`: transparent with muted hover. Use for low-emphasis actions.
 * - `destructive`: danger token fill (`bg-destructive`). Use for irreversible actions.
 * - `link`: primary-coloured inline text link, no solid fill.
 *
 * Text buttons use `rounded-md`. Round icon buttons (e.g. avatar menu) should
 * pass `className="rounded-full"` at the call site.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap cursor-pointer",
    "rounded-md font-medium text-label",
    "transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-accent-hover active:bg-accent-active",
        secondary: "bg-secondary text-foreground border border-border hover:bg-muted hover:border-border-strong",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:text-accent-hover hover:underline rounded-sm",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 px-3 py-1.5 has-[>svg]:px-2.5",
        xs: "h-7 px-2.5 py-1 text-caption gap-1 has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-10 px-5 py-2.5 text-body has-[>svg]:px-4",
        tab: "h-8 px-3 py-1.5",
        icon: "size-9 rounded-md",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10 rounded-md",
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
