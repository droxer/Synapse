"use client";

import { Paperclip, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { formatFileSize } from "@/shared/lib/utils";
import { useTranslation } from "@/i18n";

interface FileAttachmentChipProps {
  readonly name: string;
  readonly size: number;
  readonly previewUrl?: string;
  readonly onRemove?: () => void;
}

export function FileAttachmentChip({ name, size, previewUrl, onRemove }: FileAttachmentChipProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full bg-muted py-1 pr-1 pl-1.5 text-xs text-foreground">
      {previewUrl ? (
        <img src={previewUrl} alt={name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <Paperclip className="ml-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="max-w-[120px] truncate font-medium">{name}</span>
      <span className="tabular-nums text-muted-foreground">{formatFileSize(size)}</span>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label={t("chat.removeFile", { name })}
          className="touch-target text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
