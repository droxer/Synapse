"use client";

import { type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Timer, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ChannelProviderIcon } from "./ChannelProviderIcon";

type ProviderKey = "telegram" | "discord";

interface ProviderConfigShellProps {
  provider: ProviderKey;
  open: boolean;
  title: string;
  description: string;
  error: string | null;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ProviderConfigShell({
  provider,
  open,
  title,
  description,
  error,
  loading,
  onOpenChange,
  onClose,
  children,
}: ProviderConfigShellProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-[28rem] p-0 gap-0"
      >
        <div className="flex items-center gap-3.5 px-6 pt-5 pb-2">
          <ChannelProviderIcon provider={provider} size="lg" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-subtitle-lg text-foreground">{title}</DialogTitle>
            <DialogDescription className="text-caption text-muted-foreground break-words">
              {description}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("a11y.close")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="relative px-6 pt-3 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-danger-subtle px-3 py-2 text-body-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="h-10 rounded-lg skeleton-shimmer" />
              <div className="h-24 rounded-xl skeleton-shimmer" />
              <div className="h-10 rounded-full skeleton-shimmer" />
            </div>
          ) : (
            children
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProviderStatusBadge({ label, tone }: { label: string; tone: "ok" | "warn" }) {
  return (
    <Badge variant={tone === "ok" ? "neutral" : "warning"} className="shrink-0">
      {tone === "warn" && <span className="h-1 w-1 rounded-full bg-warning" aria-hidden="true" />}
      {label}
    </Badge>
  );
}

interface ProviderBotInfoRowProps {
  displayName: string;
  maskedToken: string;
  statusLabel: string;
  statusTone: "ok" | "warn";
}

export function ProviderBotInfoRow({
  displayName,
  maskedToken,
  statusLabel,
  statusTone,
}: ProviderBotInfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-soft p-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-body-sm-bold text-foreground truncate" title={displayName}>{displayName}</p>
        <p className="text-caption text-muted-foreground font-mono truncate">{maskedToken}</p>
      </div>
      <ProviderStatusBadge label={statusLabel} tone={statusTone} />
    </div>
  );
}

interface ProviderHelpAccordionProps {
  id: string;
  title: string;
  steps: string[];
  open: boolean;
  onToggle: () => void;
  externalLink?: { href: string; label: string };
}

export function ProviderHelpAccordion({
  id,
  title,
  steps,
  open,
  onToggle,
  externalLink,
}: ProviderHelpAccordionProps) {
  const { t } = useTranslation();
  const newTabLabel = t("a11y.opensInNewTab");
  const panelId = `${id}-panel`;
  return (
    <div className="rounded-xl overflow-hidden bg-surface-soft">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-body-sm-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>
      {open && (
        <div
          id={panelId}
          className="px-4 pb-3 space-y-2 text-muted-foreground"
        >
          <ol className="space-y-2">
            {steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-micro tabular-nums text-muted-foreground" aria-hidden="true">
                  {idx + 1}
                </span>
                <span className="min-w-0 break-words text-caption text-foreground">{step}</span>
              </li>
            ))}
          </ol>
          {externalLink && (
            <a
              href={externalLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-caption-bold text-primary hover:text-cobalt-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm"
            >
              {externalLink.label}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">{newTabLabel}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

interface ProviderTokenSnippetProps {
  command: string;
  copied: boolean;
  expiresInMinutes: number;
  onCopy: () => void;
  copyLabel: string;
  copiedLabel: string;
  expiryLabel: string;
  caption?: ReactNode;
  deepLink?: { href: string; label: string };
}

export function ProviderTokenSnippet({
  command,
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
  expiryLabel,
  caption,
  deepLink,
}: ProviderTokenSnippetProps) {
  const { t } = useTranslation();
  const newTabLabel = t("a11y.opensInNewTab");
  return (
    <div className="rounded-xl bg-accent-subtle p-3 space-y-2.5">
      {caption && (
        <p className="text-caption text-muted-foreground px-0.5">{caption}</p>
      )}
      <div className="flex items-center gap-2 rounded-lg bg-background p-1 pl-3">
        <code className="flex-1 min-w-0 py-1.5 font-mono text-caption text-foreground break-all">
          {command}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={onCopy}
          className="shrink-0"
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? copiedLabel : copyLabel}
        </Button>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? copiedLabel : ""}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="inline-flex items-center gap-1 text-micro text-muted-foreground">
          <Timer className="h-3 w-3" aria-hidden="true" />
          {expiryLabel}
        </span>
        {deepLink && (
          <a
            href={deepLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-caption-bold text-primary hover:text-cobalt-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm"
          >
            {deepLink.label}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">{newTabLabel}</span>
          </a>
        )}
      </div>
    </div>
  );
}

interface ProviderLinkedAccountRowProps {
  displayName: string;
  linkedAtLabel: string;
  unlinkLabel: string;
  onUnlink: () => void;
  disabled?: boolean;
}

export function ProviderLinkedAccountRow({
  displayName,
  linkedAtLabel,
  unlinkLabel,
  onUnlink,
  disabled,
}: ProviderLinkedAccountRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-soft p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-body-sm-bold text-muted-foreground" aria-hidden="true">
        {displayName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm-bold text-foreground truncate" title={displayName}>{displayName}</p>
        <p className="text-caption text-text-subtle">{linkedAtLabel}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onUnlink}
        disabled={disabled}
        className="shrink-0 text-destructive hover:bg-danger-subtle hover:text-destructive"
      >
        {unlinkLabel}
      </Button>
    </div>
  );
}

interface ProviderDangerZoneProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}

export function ProviderDangerZone({
  title,
  description,
  actionLabel,
  onAction,
  disabled,
}: ProviderDangerZoneProps) {
  return (
    <div className="rounded-xl bg-danger-subtle p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-caption-bold uppercase tracking-wider text-destructive">{title}</p>
          <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onAction}
          className="shrink-0 text-destructive hover:bg-danger-subtle hover:text-destructive"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function ProviderHeaderSkeleton({ provider }: { provider: ProviderKey }) {
  return (
    <div className="flex items-center gap-3.5 px-6 pt-5 pb-2" aria-hidden="true">
      <ChannelProviderIcon provider={provider} size="lg" className="opacity-60" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-24 skeleton-shimmer rounded" />
        <div className="h-2.5 w-40 skeleton-shimmer rounded" />
      </div>
    </div>
  );
}

export function ProviderTriggerCard({
  provider,
  title,
  status,
  subtitle,
  onClick,
}: {
  provider: ProviderKey;
  title: string;
  status: { label: string; tone: "ok" | "warn" };
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full flex-col gap-2 overflow-hidden rounded-xl bg-surface-soft p-3 text-left transition-[background-color] duration-200 ease-out hover:bg-[color-mix(in_srgb,var(--color-surface-soft),var(--color-ink-deep)_4%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <ChannelProviderIcon provider={provider} size="md" />
          <div className="space-y-0.5 min-w-0">
            <span className="text-body-sm-bold text-foreground block">{title}</span>
            <ProviderStatusBadge label={status.label} tone={status.tone} />
          </div>
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-circle bg-background text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true">
          <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
        </div>
      </div>
      {subtitle && (
        <p className="text-caption text-muted-foreground truncate">{subtitle}</p>
      )}
    </button>
  );
}
