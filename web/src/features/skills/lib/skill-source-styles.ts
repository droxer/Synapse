import { Package, Globe, FolderGit2 } from "lucide-react";

/**
 * Source labels are **metadata** (where the skill comes from), not run state.
 * Skills pages render these via `<Badge variant={badgeVariant}>`; `className` remains for
 * callers that pair it with `ACTIVITY_META_BADGE_CLASSES` (agent panel activity rows).
 */
export const SOURCE_STYLE = {
  bundled: { icon: Package, className: "text-success-text", badgeVariant: "success" },
  user: { icon: Globe, className: "text-info", badgeVariant: "info" },
  project: { icon: FolderGit2, className: "text-warning-text", badgeVariant: "warning" },
} as const;

/** Only user-installed skills can be uninstalled (backend rejects shared/project skills with 403). */
export function isUninstallableSource(sourceType: string): boolean {
  return sourceType === "user";
}

export const SOURCE_LABEL_KEY: Record<string, string> = {
  bundled: "skills.source.bundled",
  user: "skills.source.user",
  project: "skills.source.project",
};
