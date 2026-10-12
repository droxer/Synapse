"use client";

import { useState, type ChangeEvent } from "react";
import { Lightbulb, X, Search, Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "@/i18n";
import { useSkillsCache } from "../hooks/use-skills-cache";
import { normalizeSkillName } from "../lib/normalize-skill-name";

interface SkillSelectorProps {
  readonly selectedSkill: string | null;
  readonly onSelect: (skillName: string | null) => void;
  /** Display variant */
  readonly variant?: "default" | "welcome" | "shelf";
}

export function SkillSelector({
  selectedSkill,
  onSelect,
  variant = "default",
}: SkillSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const { getAllSkills } = useSkillsCache();
  const skills = getAllSkills().filter((s) => s.enabled !== false);

  const filtered = filter
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(filter.toLowerCase()) ||
          s.description?.toLowerCase().includes(filter.toLowerCase()),
      )
    : skills;

  const handleSelect = (name: string) => {
    if (selectedSkill === name) {
      onSelect(null);
    } else {
      onSelect(name);
    }
    setOpen(false);
    setFilter("");
  };

  return (
    <>
      {/* Trigger button + popover */}
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFilter(""); }}>
        {selectedSkill && variant !== "shelf" ? (
          /* Active skill chip — morphs in-place to show selection */
          <div className={cn(
            "group flex items-center gap-1 rounded-sm transition-colors",
            "bg-muted text-foreground",
            "hover:bg-[color-mix(in_srgb,var(--color-muted),var(--color-foreground)_6%)]",
            variant === "welcome" ? "h-8 pl-2.5 pr-1" : "h-7 pl-2 pr-0.5",
          )}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${t("skills.selector.select")}: ${normalizeSkillName(selectedSkill)}`}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-xs text-caption-bold outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <Lightbulb aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline max-w-[10rem] truncate">
                  {normalizeSkillName(selectedSkill)}
                </span>
              </button>
            </PopoverTrigger>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              aria-label={t("skills.selector.remove", { name: normalizeSkillName(selectedSkill) })}
              className={cn(
                "relative flex items-center justify-center rounded-xs transition-colors",
                "text-muted-foreground hover:bg-background hover:text-foreground",
                // Expand the hit area to 24px+ without growing the visual chip.
                "after:absolute after:-inset-1.5 after:content-['']",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                variant === "welcome" ? "h-6 w-6" : "h-5 w-5",
              )}
            >
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          </div>
        ) : (
          /* Inactive trigger — plain pill or shelf icon */
          <PopoverTrigger asChild>
            {variant === "shelf" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("skills.selector.select")}
                className={cn(
                  "h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground",
                  selectedSkill && "text-foreground",
                )}
              >
                <Lightbulb aria-hidden="true" className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("skills.selector.select")}
                className={cn(
                  "gap-1.5 px-2.5 text-caption-bold text-muted-foreground hover:bg-muted hover:text-foreground",
                  variant === "welcome" ? "h-8 px-3 bg-muted" : "h-7 bg-muted",
                )}
              >
                <Lightbulb aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("chat.skillLabel")}</span>
              </Button>
            )}
          </PopoverTrigger>
        )}
        <PopoverContent
          side="top"
          align="start"
          className="w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-popover p-0"
        >
          {/* Search filter */}
          {skills.length > 4 && (
            <div className="px-3 pb-1 pt-3">
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-1.5 transition-colors focus-within:border-focus focus-within:ring-2 focus-within:ring-ring/40">
                <Search aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="search"
                  name="skill-search"
                  autoComplete="off"
                  spellCheck={false}
                  value={filter}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
                  placeholder={t("skills.selector.search")}
                  aria-label={t("skills.selector.search")}
                  className="min-w-0 flex-1 bg-transparent text-caption text-foreground placeholder:text-text-subtle outline-none [&::-webkit-search-cancel-button]:hidden"
                />
              </div>
            </div>
          )}

          {/* Skill grid */}
          <div className="max-h-60 sm:max-h-72 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-caption text-muted-foreground">
                {skills.length === 0
                  ? t("skills.selector.noSkills")
                  : t("skills.selector.noMatching")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {filtered.map((skill) => {
                  const isSelected = selectedSkill === skill.name;
                  return (
                    <button
                      key={skill.name}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelect(skill.name)}
                      className={cn(
                        "group relative flex cursor-pointer flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors",
                        "hover:bg-muted",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isSelected && "bg-muted",
                      )}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5">
                          <Check aria-hidden="true" className="h-3.5 w-3.5 text-foreground" strokeWidth={2.5} />
                        </div>
                      )}

                      {/* Skill name + source badge */}
                      <div className="flex items-center gap-1.5 pr-4">
                        <div
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors",
                            isSelected
                              ? "bg-muted text-foreground"
                              : "bg-muted text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <Lightbulb aria-hidden="true" className="h-3 w-3" />
                        </div>
                        <span className="min-w-0 truncate text-caption-bold text-foreground">
                          {normalizeSkillName(skill.name)}
                        </span>
                      </div>

                      {/* Description */}
                      {skill.description && (
                        <div className="line-clamp-2 pl-7 text-caption text-muted-foreground">
                          {skill.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
