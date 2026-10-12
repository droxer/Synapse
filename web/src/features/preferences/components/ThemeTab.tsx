"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { useUserPreferences } from "@/shared/hooks/use-user-preferences";
import { useTranslation } from "@/i18n";
import { TabHeader } from "./TabHeader";

type ThemeValue = "light" | "dark" | "system";

const DEFAULT_THEME: ThemeValue = "dark";

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

const SWATCHES: readonly { readonly token: string; readonly labelKey: string }[] = [
  { token: "var(--color-background)", labelKey: "preferences.theme.swatch.background" },
  { token: "var(--color-muted)", labelKey: "preferences.theme.swatch.muted" },
  { token: "var(--color-foreground)", labelKey: "preferences.theme.swatch.foreground" },
  { token: "var(--color-primary)", labelKey: "preferences.theme.swatch.primary" },
  { token: "var(--color-accent-emerald)", labelKey: "preferences.theme.swatch.accent" },
];

function ThemePreview() {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-lg bg-background">
      <div className="flex items-baseline gap-3 px-4 pb-2 pt-4">
        <span
          className="text-heading-lg leading-none text-foreground"
          style={{ fontFamily: "var(--font-brand-family)" }}
          aria-hidden="true"
        >
          Aa
        </span>
        <span className="label-section text-text-subtle">Synapse</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-body-sm text-foreground">
          {t("preferences.theme.previewSample")}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          {t("preferences.theme.previewCaption")}
        </p>
      </div>
      <div className="flex items-stretch gap-1 px-3 pb-3 pt-1" aria-hidden="true">
        {SWATCHES.map(({ token, labelKey }) => (
          <div key={labelKey} className="flex min-w-0 flex-1 flex-col items-stretch gap-1">
            <div className="h-6 rounded-sm shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-foreground)_8%,transparent)]" style={{ background: token }} />
            <span className="label-section truncate text-center text-text-subtle">{t(labelKey)}</span>
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

  const currentTheme: ThemeValue = mounted ? ((theme as ThemeValue | undefined) ?? DEFAULT_THEME) : DEFAULT_THEME;
  const selectedOption =
    THEME_OPTIONS.find((option) => option.value === currentTheme) ??
    THEME_OPTIONS.find((option) => option.value === DEFAULT_THEME) ??
    THEME_OPTIONS[0];
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
          <SelectedIcon aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-body-sm-bold text-foreground">
            {t(selectedOption.labelKey)}
          </span>
        </div>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {t(selectedOption.descKey)}
        </p>
      </div>
    </div>
  );
}
