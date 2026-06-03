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
        className="w-full sm:max-w-[28rem] rounded-lg border border-hairline-soft bg-canvas p-0 gap-0"
      >
        <div className="flex items-center gap-3.5 px-6 py-4 border-b border-hairline-soft/60">
          <ChannelProviderIcon
            provider={provider}
            size="lg"
            className="rounded-xl ring-1 ring-border"
          />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-subtitle-lg text-ink-deep">{title}</DialogTitle>
            <DialogDescription className="text-caption text-steel truncate">
              {description}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("a11y.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-steel transition-colors hover:bg-surface-soft hover:text-ink-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-critical-strong bg-critical-strong/5 px-3 py-2 text-body-sm text-critical"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="h-10 rounded-md skeleton-shimmer" />
              <div className="h-24 rounded-md skeleton-shimmer" />
              <div className="h-10 rounded-md skeleton-shimmer" />
            </div>
          ) : (
            children
          )}
        </div>
      </DialogContent>
    </Dialog>
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
    <div className="flex items-center justify-between gap-3 rounded-md border border-hairline-soft bg-card p-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-body-sm-bold text-ink-deep tracking-tight truncate">{displayName}</p>
        <p className="text-caption text-steel font-mono truncate">{maskedToken}</p>
      </div>
      <span
        className={
          statusTone === "ok"
            ? "shrink-0 rounded-sm border border-hairline-soft bg-surface-soft px-1.5 py-0.5 text-micro font-medium uppercase text-steel"
            : "shrink-0 inline-flex items-center gap-1 rounded-sm bg-accent-amber/10 px-1.5 py-0.5 text-micro font-medium uppercase text-accent-amber ring-1 ring-accent-amber/25"
        }
      >
        {statusTone === "warn" && <span className="h-1 w-1 rounded-full bg-accent-amber" />}
        {statusLabel}
      </span>
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
  const panelId = `${id}-panel`;
  return (
    <div className="rounded-md border border-hairline-soft overflow-hidden bg-surface-soft">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between px-3 py-2 text-body-sm-bold text-steel transition-colors hover:text-ink-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <span className="flex items-center gap-2">
          <ExternalLink className="h-3.5 w-3.5" />
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div
          id={panelId}
          className="border-t border-hairline-soft/60 px-4 py-3 space-y-2 leading-normal text-steel"
        >
          <ol className="space-y-2">
            {steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-hairline-soft bg-canvas text-micro font-semibold text-steel">
                  {idx + 1}
                </span>
                <span className="text-caption text-ink-deep">{step}</span>
              </li>
            ))}
          </ol>
          {externalLink && (
            <a
              href={externalLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-caption-bold text-cobalt hover:text-cobalt-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 rounded-sm"
            >
              {externalLink.label}
              <ExternalLink className="h-3 w-3" />
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
  return (
    <div className="rounded-lg border border-cobalt/30 bg-gradient-to-b from-cobalt/[0.04] to-transparent p-3 space-y-2.5">
      {caption && (
        <p className="text-caption text-steel leading-snug px-0.5">{caption}</p>
      )}
      <div className="flex items-stretch rounded-md border border-hairline-soft overflow-hidden bg-canvas">
        <code className="flex-1 min-w-0 px-3 py-2.5 font-mono text-caption text-ink-deep truncate">
          {command}
        </code>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? copiedLabel : copyLabel}
          className="flex shrink-0 items-center justify-center gap-1.5 border-l border-hairline-soft bg-surface-soft px-3 py-2.5 text-caption-bold text-steel transition-colors hover:bg-card hover:text-ink-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus/40"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-ink-deep" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="inline-flex items-center gap-1 text-micro text-steel">
          <Timer className="h-3 w-3" />
          {expiryLabel}
        </span>
        {deepLink && (
          <a
            href={deepLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-caption-bold text-cobalt hover:text-cobalt-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 rounded-sm"
          >
            {deepLink.label}
            <ExternalLink className="h-3 w-3" />
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
    <div className="flex items-center gap-3 rounded-md border border-hairline-soft bg-card p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline-soft bg-surface-soft text-body-sm-bold text-steel">
        {displayName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm-bold text-ink-deep truncate">{displayName}</p>
        <p className="text-caption text-stone">{linkedAtLabel}</p>
      </div>
      <button
        type="button"
        onClick={onUnlink}
        disabled={disabled}
        className="shrink-0 rounded-md border border-hairline-soft bg-card px-2.5 py-1 text-caption-bold text-critical transition-colors hover:border-critical-strong hover:bg-critical-strong/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50"
      >
        {unlinkLabel}
      </button>
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
    <div className="rounded-md border border-dashed border-critical-strong/40 bg-critical-strong/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-caption-bold uppercase tracking-wider text-critical">{title}</p>
          <p className="mt-0.5 text-caption text-steel leading-snug">{description}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onAction}
          className="shrink-0 text-critical hover:bg-critical-strong/10 hover:text-critical"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function ProviderHeaderSkeleton({ provider }: { provider: ProviderKey }) {
  return (
    <div className="flex items-center gap-3.5 px-6 py-4 border-b border-hairline-soft/60">
      <ChannelProviderIcon provider={provider} size="lg" className="rounded-xl ring-1 ring-border opacity-60" />
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
      className="group relative flex w-full flex-col gap-2 overflow-hidden rounded-lg border border-hairline-soft bg-card p-3 text-left transition-[border-color,background-color] duration-200 ease-out hover:border-hairline hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <ChannelProviderIcon provider={provider} size="md" />
          <div className="space-y-0.5 min-w-0">
            <span className="text-body-sm-bold text-ink-deep block">{title}</span>
            <span
              className={
                status.tone === "ok"
                  ? "inline-flex items-center gap-1.5 rounded-sm border border-hairline-soft bg-surface-soft px-1.5 py-0.5 text-micro font-medium uppercase text-steel"
                  : "inline-flex items-center gap-1 rounded-sm bg-accent-amber/10 px-1.5 py-0.5 text-micro font-medium uppercase text-accent-amber ring-1 ring-accent-amber/25"
              }
            >
              {status.tone === "warn" && <span className="h-1 w-1 rounded-full bg-accent-amber" />}
              {status.label}
            </span>
          </div>
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-hairline-soft bg-canvas text-steel transition-colors group-hover:bg-surface-soft group-hover:text-ink-deep">
          <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
        </div>
      </div>
      {subtitle && (
        <p className="text-caption text-steel truncate">{subtitle}</p>
      )}
    </button>
  );
}
