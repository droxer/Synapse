"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

import { applyThemeFavicon, type ResolvedAppTheme } from "@/shared/lib/theme-favicon";

/** Keep favicon and apple-touch-icon aligned with the resolved app theme. */
export function ThemeFavicon() {
  const { resolvedTheme, theme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    applyThemeFavicon(resolvedTheme as ResolvedAppTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncFromSystem = () => {
      applyThemeFavicon(media.matches ? "dark" : "light");
    };

    media.addEventListener("change", syncFromSystem);
    return () => media.removeEventListener("change", syncFromSystem);
  }, [theme]);

  return null;
}
