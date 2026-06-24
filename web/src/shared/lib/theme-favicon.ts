export const FAVICON = {
  light: "/favicon-light.svg",
  dark: "/favicon-dark.svg",
} as const;

export const APPLE_TOUCH = {
  light: "/apple-touch-icon.png",
  dark: "/apple-touch-icon-dark.png",
} as const;

export type ResolvedAppTheme = "light" | "dark";

export function faviconAssetsForTheme(theme: ResolvedAppTheme) {
  return theme === "dark"
    ? { icon: FAVICON.dark, apple: APPLE_TOUCH.dark }
    : { icon: FAVICON.light, apple: APPLE_TOUCH.light };
}

/** Mirror next-themes resolution before React hydrates. */
export function resolveThemeFromStorage(): ResolvedAppTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light") return "light";
    if (stored === "dark") return "dark";
    if (stored === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  } catch {
    // localStorage may be unavailable
  }

  return "dark";
}

export function applyThemeFavicon(theme: ResolvedAppTheme) {
  if (typeof document === "undefined") return;

  const { icon, apple } = faviconAssetsForTheme(theme);

  let iconLink = document.querySelector<HTMLLinkElement>('link[data-theme-favicon="true"]');
  if (!iconLink) {
    iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.type = "image/svg+xml";
    iconLink.setAttribute("data-theme-favicon", "true");
    document.head.appendChild(iconLink);
  }
  iconLink.href = icon;

  let appleLink = document.querySelector<HTMLLinkElement>('link[data-theme-apple-icon="true"]');
  if (!appleLink) {
    appleLink = document.createElement("link");
    appleLink.rel = "apple-touch-icon";
    appleLink.setAttribute("data-theme-apple-icon", "true");
    document.head.appendChild(appleLink);
  }
  appleLink.href = apple;

  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => {
    if (link.getAttribute("data-theme-favicon") !== "true") {
      link.remove();
    }
  });

  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((link) => {
    if (link.getAttribute("data-theme-apple-icon") !== "true") {
      link.remove();
    }
  });
}
