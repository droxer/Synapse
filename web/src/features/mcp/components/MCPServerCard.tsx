"use client";

import { Trash2, Blocks, Radio, Wrench, Globe, Pencil } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { ToolingCard } from "@/shared/components/ToolingCard";
import { cn } from "@/shared/lib/utils";
import {
  TOOLING_STATUS_TOGGLE_CLASSES,
  TOOLING_STATUS_TOGGLE_DISABLED_CLASSES,
  TOOLING_STATUS_TOGGLE_ENABLED_CLASSES,
} from "@/shared/lib/tooling-ui-styles";
import { useTranslation } from "@/i18n";
import type { MCPServer } from "../api/mcp-api";

const transportStyle = {
  sse: { icon: Radio, label: "sse" },
  streamablehttp: { icon: Globe, label: "streamablehttp" },
} as const;

interface MCPServerCardProps {
  readonly server: MCPServer;
  readonly onEdit?: (server: MCPServer) => void;
  readonly onDelete?: (name: string) => void;
  readonly onToggle?: (name: string, enabled: boolean) => void;
}

export function MCPServerCard({
  server,
  onEdit,
  onDelete,
  onToggle,
}: MCPServerCardProps) {
  const { t } = useTranslation();
  const transport = transportStyle[server.transport];
  const TransportIcon = transport.icon;
  const isDisabled = server.enabled === false;

  const badge = (
    <Badge
      variant="neutral"
      className={cn(
        "font-mono transition-opacity duration-200",
        isDisabled && "opacity-60",
      )}
    >
      <TransportIcon aria-hidden="true" />
      {transport.label}
    </Badge>
  );

  const headerActions = (
    <>
      {onEdit && server.editable !== false && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("mcp.editServer", { name: server.name })}
              className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onEdit(server)}
            >
              <Pencil aria-hidden="true" className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("mcp.editServer", { name: server.name })}
          </TooltipContent>
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("mcp.removeServer", { name: server.name })}
              className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(server.name)}
            >
              <Trash2 aria-hidden="true" className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("mcp.removeServer", { name: server.name })}
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );

  const footerRight = onToggle ? (
    <button
      type="button"
      role="switch"
      aria-checked={!isDisabled}
      aria-label={`${isDisabled ? t("mcp.enable") : t("mcp.disable")} ${server.name}`}
      className={cn(
        TOOLING_STATUS_TOGGLE_CLASSES,
        isDisabled
          ? TOOLING_STATUS_TOGGLE_DISABLED_CLASSES
          : TOOLING_STATUS_TOGGLE_ENABLED_CLASSES,
      )}
      onClick={() => onToggle(server.name, isDisabled)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full transition-colors duration-150",
          isDisabled ? "bg-border-strong" : "bg-success",
        )}
      />
      {isDisabled ? t("mcp.disabled") : t("mcp.enabled")}
    </button>
  ) : null;

  return (
    <ToolingCard
      icon={
        <Blocks
          aria-hidden="true"
          className={cn("h-4 w-4", isDisabled ? "text-text-subtle" : "text-muted-foreground")}
        />
      }
      badge={badge}
      headerActions={headerActions}
      title={server.name}
      body={
        <div
          className={cn(
            "flex min-w-0 items-center gap-3 text-caption",
            isDisabled ? "text-text-subtle" : "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-1">
            <Wrench aria-hidden="true" className="h-3 w-3" />
            {server.tool_count === 1
              ? t("mcp.toolCount", { count: 1 })
              : t("mcp.toolsCount", { count: server.tool_count })}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isDisabled
                  ? "bg-border-strong"
                  : server.status === "connected"
                    ? "bg-success"
                    : "bg-border-strong",
              )}
            />
            {server.status === "connected" && !isDisabled
              ? t("mcp.connected")
              : t("mcp.disconnected")}
          </span>
        </div>
      }
      footerLeft={
        <span className="min-w-0 truncate font-mono text-micro text-text-subtle">
          {server.url || " "}
        </span>
      }
      footerRight={footerRight}
      disabled={isDisabled}
    />
  );
}
