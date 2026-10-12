"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export interface SegmentedControlOption<TValue extends string> {
  readonly value: TValue;
  readonly label: ReactNode;
  readonly ariaLabel?: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

interface SegmentedControlProps<TValue extends string> {
  readonly value: TValue;
  readonly options: readonly SegmentedControlOption<TValue>[];
  readonly onValueChange: (value: TValue) => void;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly optionClassName?: string;
  readonly selectedOptionClassName?: string;
  readonly inactiveOptionClassName?: string;
}

export function SegmentedControl<TValue extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
  optionClassName,
  selectedOptionClassName,
  inactiveOptionClassName,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.ariaLabel}
            aria-pressed={selected}
            disabled={option.disabled}
            onClick={() => {
              if (!option.disabled && option.value !== value) {
                onValueChange(option.value);
              }
            }}
            className={cn(
              "touch-target inline-flex min-h-7 items-center justify-center gap-1.5 rounded-sm px-2.5 py-1 text-body-sm-bold transition-[color,background-color,box-shadow] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? cn("bg-background text-foreground shadow-xs dark:bg-surface-hover", selectedOptionClassName)
                                : cn("text-muted-foreground hover:bg-background/60 hover:text-foreground", inactiveOptionClassName),
              option.disabled && "cursor-not-allowed opacity-50",
              optionClassName,
            )}
          >
            {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
            <span className="whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
