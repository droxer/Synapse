"use client";

import { Trash2, Lightbulb } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ToolingCard } from "@/shared/components/ToolingCard";
import { cn } from "@/shared/lib/utils";
import {
  TOOLING_STATUS_TOGGLE_CLASSES,
  TOOLING_STATUS_TOGGLE_DISABLED_CLASSES,
  TOOLING_STATUS_TOGGLE_ENABLED_CLASSES,
} from "@/shared/lib/tooling-ui-styles";
import { useTranslation } from "@/i18n";
import { normalizeSkillName } from "../lib/normalize-skill-name";
import { SOURCE_STYLE, SOURCE_LABEL_KEY, isUninstallableSource } from "../lib/skill-source-styles";
import type { Skill } from "../api/skills-api";

interface SkillCardProps {
  readonly skill: Skill;
  readonly onDelete?: (name: string) => void;
  readonly onToggle?: (name: string, enabled: boolean) => void;
  /** True while an enable/disable request for this skill is in flight. */
  readonly isToggling?: boolean;
}

const SOURCE_FOOTER_KEY: Record<Skill["source_type"], string> = {
  bundled: "skills.sectionBuiltIn",
  user: "skills.sectionInstalled",
  project: "skills.sectionInstalled",
};

export function SkillCard({ skill, onDelete, onToggle, isToggling = false }: SkillCardProps) {
  const { t } = useTranslation();
  const config = SOURCE_STYLE[skill.source_type] ?? SOURCE_STYLE.bundled;
  const Icon = config.icon;
  const labelKey = SOURCE_LABEL_KEY[skill.source_type] ?? SOURCE_LABEL_KEY.bundled;
  const showDelete = isUninstallableSource(skill.source_type) && onDelete;
  const isDisabled = skill.enabled === false;
  const displayName = normalizeSkillName(skill.name);
  const skillHref = `/skills/${encodeURIComponent(skill.name)}`;

  const badge = (
    <Badge
      variant={config.badgeVariant}
      className={cn("transition-opacity duration-200", isDisabled && "opacity-60")}
    >
      <Icon aria-hidden="true" />
      {t(labelKey)}
    </Badge>
  );

  const headerActions = showDelete ? (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={`${t("skills.uninstall")} ${displayName}`}
      className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      onClick={(e) => {
        e.preventDefault();
        onDelete?.(skill.name);
      }}
    >
      <Trash2 aria-hidden="true" className="h-3 w-3" />
    </Button>
  ) : null;

  const footerRight = onToggle ? (
    <button
      type="button"
      role="switch"
      aria-checked={!isDisabled}
      aria-label={`${displayName}: ${isDisabled ? t("skills.disabled") : t("skills.enabled")}`}
      aria-busy={isToggling || undefined}
      disabled={isToggling}
      className={cn(
        "disabled:cursor-wait disabled:opacity-60",
        TOOLING_STATUS_TOGGLE_CLASSES,
        isDisabled
          ? TOOLING_STATUS_TOGGLE_DISABLED_CLASSES
          : TOOLING_STATUS_TOGGLE_ENABLED_CLASSES,
      )}
      onClick={(e) => {
        e.preventDefault();
        if (isToggling) return;
        onToggle?.(skill.name, isDisabled);
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full transition-colors duration-150",
          isDisabled ? "bg-border-strong" : "bg-success",
        )}
      />
      {isDisabled ? t("skills.disabled") : t("skills.enabled")}
    </button>
  ) : null;

  return (
    <ToolingCard
      icon={
        <Lightbulb
          aria-hidden="true"
          className={cn("h-4 w-4", isDisabled ? "text-text-subtle" : "text-muted-foreground")}
        />
      }
      badge={badge}
      headerActions={headerActions}
      title={displayName}
      body={
        skill.description ? (
          <p
            className={cn(
              "line-clamp-2 text-caption",
              isDisabled ? "text-text-subtle" : "text-muted-foreground",
            )}
          >
            {skill.description}
          </p>
        ) : null
      }
      footerLeft={
        <span className="label-mono truncate text-text-subtle">
          {t(SOURCE_FOOTER_KEY[skill.source_type] ?? "skills.sectionInstalled")}
        </span>
      }
      footerRight={footerRight}
      href={skillHref}
      accessibleLabel={displayName}
      disabled={isDisabled}
    />
  );
}
