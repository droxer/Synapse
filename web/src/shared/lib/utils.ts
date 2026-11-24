import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Custom typography role utilities defined via `@utility text-*` in globals.css.
 * Registering them under the `font-size` class group prevents `tailwind-merge`
 * from treating them as text-color classes and stripping them whenever a color
 * utility (e.g. `text-foreground`, `text-info`, `text-muted-foreground`) follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "hero-display",
            "display-lg",
            "heading-lg",
            "heading-md",
            "heading-sm",
            "subtitle-lg",
            "subtitle-md",
            "body-md",
            "body-md-bold",
            "body-sm",
            "body-sm-bold",
            "caption",
            "caption-bold",
            "micro",
            "button-md",
            "link-md",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
