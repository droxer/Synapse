import * as React from "react"

import { cn } from "@/shared/lib/utils"

/**
 * Card variants — surfaces separate by tonal fill, not borders (lighter look).
 * Cards are white on the slightly-grey page background, so no hairline border is needed.
 * - `default`: primary card surface, borderless, separated by fill.
 * - `sunken`: recessed card with muted background, borderless.
 * - `interactive`: borderless card that lifts with a subtle shadow on hover.
 * - `outlined`: opt-in bordered card for when a card sits on a same-tone surface (e.g. inside a white dialog).
 * - `panel`: alias of default for backward compatibility.
 */
type CardVariant = "default" | "sunken" | "interactive" | "outlined" | "panel"

const cardVariantClass: Record<CardVariant, string> = {
  default: "flex flex-col gap-6 py-6 rounded-lg bg-card text-card-foreground",
  sunken: "flex flex-col gap-6 py-6 rounded-lg bg-muted text-card-foreground",
  interactive:
    "flex flex-col gap-6 py-6 rounded-lg bg-card text-card-foreground hover:shadow-sm",
  outlined:
    "flex flex-col gap-6 py-6 rounded-lg border border-border bg-card text-card-foreground",
  panel: "flex flex-col gap-6 py-6 rounded-lg bg-card text-card-foreground",
}

function Card({
  className,
  variant = "panel",
  ...props
}: React.ComponentProps<"div"> & { variant?: CardVariant }) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        cardVariantClass[variant],
        "transition-[box-shadow,border-color,transform] duration-200 ease-out",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-title text-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-body text-text-muted", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
