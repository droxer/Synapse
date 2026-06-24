"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { useUserPreferences } from "@/shared/hooks/use-user-preferences";
import { useTranslation } from "@/i18n";
import { TabHeader } from "./TabHeader";

type ThemeValue = "light" | "dark" | "system";

const THEME_OPTIONS: readonly {
  readonly value: ThemeValue;
  readonly icon: typeof Sun;
  readonly labelKey: string;
  readonly descKey: string;
}[] = [
  { value: "light", icon: Sun, labelKey: "theme.light", descKey: "preferences.theme.lightDesc" },
  { value: "dark", icon: Moon, labelKey: "theme.dark", descKey: "preferences.theme.darkDesc" },
  { value: "system", icon: Monitor, labelKey: "theme.system", descKey: "preferences.theme.systemDesc" },
];

const SWATCHES: readonly { readonly token: string; readonly label: string }[] = [
  { token: "var(--color-background)", label: "background" },
  { token: "var(--color-muted)", label: "muted" },
  { token: "var(--color-foreground)", label: "foreground" },
  { token: "var(--color-primary)", label: "primary" },
  { token: "var(--color-accent-emerald)", label: "accent" },
];

function ThemePreview() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-baseline gap-3 border-b border-border/60 px-4 pb-3 pt-4">
        <span
          className="text-[2.25rem] leading-none text-foreground"
          style={{ fontFamily: "var(--font-brand-family)" }}
          aria-hidden="true"
        >
          Aa
        </span>
        <span className="label-mono text-text-subtle">Synapse</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-body-sm text-foreground">
          The quick brown fox jumps over the lazy dog.
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          Display + body type rendered in the active theme.
        </p>
      </div>
      <div
        className="flex items-stretch gap-1 border-t border-border/60 px-3 py-2.5"
        aria-hidden="true"
      >
        {SWATCHES.map(({ token, label }) => (
          <div key={label} className="flex flex-1 flex-col items-stretch gap-1">
            <div
              className="h-6 rounded-sm ring-1 ring-inset ring-border/60"
              style={{ background: token }}
            />
            <span className="label-mono text-center text-text-subtle">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThemeTab() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { savePreferences } = useUserPreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (theme as ThemeValue) ?? "dark" : "dark";
  const selectedOption = THEME_OPTIONS.find((option) => option.value === currentTheme) ?? THEME_OPTIONS[2];
  const SelectedIcon = selectedOption.icon;

  const handleSelect = (value: ThemeValue) => {
    setTheme(value);
    savePreferences({ theme: value });
  };

  return (
    <div>
      <TabHeader
        eyebrow={t("preferences.tabs.theme")}
        title={t("preferences.theme.title")}
        description={t("preferences.theme.description")}
      />

      <SegmentedControl<ThemeValue>
        ariaLabel={t("preferences.theme.title")}
        value={currentTheme}
        onValueChange={handleSelect}
        className="w-full"
        optionClassName="flex-1"
        options={THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => ({
          value,
          label: t(labelKey),
          icon: <Icon className="h-3.5 w-3.5" />,
        }))}
      />

      <div className="surface-panel mt-4 p-3">
        <ThemePreview />
        <div className="mt-3 flex items-center gap-1.5">
          <SelectedIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {t(selectedOption.labelKey)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t(selectedOption.descKey)}
        </p>
      </div>
    </div>
  );
}
