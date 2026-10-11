"use client";

import type { ChangeEvent, ClipboardEvent } from "react";
import { Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { useTranslation } from "@/i18n";
import type { MCPTransport } from "../lib/parse-mcp-config";

interface MCPServerFormProps {
  readonly error: string | null;
  readonly onDismissError: () => void;
  readonly formSchema: string;
  readonly onFormSchemaChange: (value: string) => void;
  readonly formName: string;
  readonly formTransport: MCPTransport;
  readonly headerCount: number;
  readonly submitting: boolean;
  readonly submitLabel: string;
  /** Label shown while submitting, e.g. "Connecting…" */
  readonly submittingLabel: string;
  readonly onApplySchema: (value?: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
  /** HTML id prefix for form fields (avoids id collisions when multiple instances exist) */
  readonly idPrefix?: string;
}

export function MCPServerForm({
  error,
  onDismissError,
  formSchema,
  onFormSchemaChange,
  formName,
  formTransport,
  headerCount,
  submitting,
  submitLabel,
  submittingLabel,
  onApplySchema,
  onSubmit,
  onCancel,
  idPrefix = "mcp",
}: MCPServerFormProps) {
  const { t } = useTranslation();
  const parsedName = formName.trim();
  const hasParsedConfig = parsedName.length > 0;
  const schemaHelper = formSchema.trim()
    ? t("mcp.schemaApplyHint")
    : t("mcp.schemaPasteHint");

  const handleSchemaPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.trim()) return;
    e.preventDefault();
    onFormSchemaChange(pasted);
    onApplySchema(pasted);
  };

  return (
    <div className="space-y-4">
      {error && (
        <ErrorBanner
          message={error}
          onDismiss={onDismissError}
          variant="compact"
          dismissLabel={t("mcp.dismissError")}
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-schema`} className="label-mono text-text-subtle">
          {t("mcp.schema")}
        </Label>
        <p className="text-caption text-muted-foreground">{schemaHelper}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-input bg-background transition-[border-color,box-shadow] duration-150 focus-within:border-focus focus-within:ring-2 focus-within:ring-ring/40">
        <Textarea
          id={`${idPrefix}-schema`}
          placeholder={t("mcp.schemaPlaceholder")}
          value={formSchema}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onFormSchemaChange(e.target.value)}
          onPaste={handleSchemaPaste}
          className="min-h-[10rem] resize-y rounded-none border-0 bg-transparent px-4 py-3 font-mono text-caption leading-relaxed focus-visible:border-transparent focus-visible:ring-0 focus-visible:px-4"
          autoFocus
        />

        <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/60 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge
              variant={hasParsedConfig ? "success" : "neutral"}
              className="max-w-full"
              aria-live="polite"
            >
              <ShieldCheck aria-hidden="true" />
              <span className="truncate">
                {hasParsedConfig ? parsedName : t("mcp.waitingForConfig")}
              </span>
            </Badge>
            {hasParsedConfig && (
              <span className="font-mono text-micro text-text-subtle">
                {formTransport}
              </span>
            )}
            {headerCount > 0 && (
              <Badge variant="success" className="tabular-nums">
                <Check aria-hidden="true" />
                {t("mcp.headersApplied", { count: headerCount })}
              </Badge>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onApplySchema()}
            disabled={submitting || !formSchema.trim()}
          >
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            {t("mcp.applySchema")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("mcp.cancel")}
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={submitting || !formSchema.trim()}
          aria-busy={submitting || undefined}
        >
          {submitting && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
