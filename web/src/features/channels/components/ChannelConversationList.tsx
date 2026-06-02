"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { listChannelConversations, type ChannelConversation } from "../api/channel-api";
import { deleteConversation } from "@/shared/api/conversation-list-api";
import { useAppStore } from "@/shared/stores";
import { getProviderColor } from "./ChannelProviderIcon";
import { useTranslation } from "@/i18n";
import { channelsListContainer, channelsListItem } from "../lib/motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

function formatRelativeTime(
  isoString: string | null,
  locale: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("channels.list.time.now");
  if (minutes < 60) return t("channels.list.time.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("channels.list.time.hours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("channels.list.time.days", { count: days });
  return new Date(isoString).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

interface ChannelConversationListProps {
  selectedConversationId: string | null;
  onSelect: (conversation: ChannelConversation) => void;
  onDeleted?: (conversationId: string) => void;
  onCountChange?: (count: number) => void;
  refreshToken?: number;
  onConversationsChange?: (conversations: ChannelConversation[]) => void;
}

export function ChannelConversationList({
  selectedConversationId,
  onSelect,
  onDeleted,
  onCountChange,
  refreshToken = 0,
  onConversationsChange,
}: ChannelConversationListProps) {
  const { locale, t } = useTranslation();
  const [conversations, setConversations] = useState<ChannelConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await listChannelConversations();
      setConversations(data.conversations);
      onCountChange?.(data.conversations.length);
      onConversationsChange?.(data.conversations);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t("channels.list.errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [onConversationsChange, onCountChange, t]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations, refreshToken]);

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    try {
      setDeletingId(pendingDeleteId);
      setActionError(null);
      await deleteConversation(pendingDeleteId);
      useAppStore.getState().bumpLibraryRefetch();
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.conversation_id !== pendingDeleteId);
        onCountChange?.(filtered.length);
        onConversationsChange?.(filtered);
        return filtered;
      });
      onDeleted?.(pendingDeleteId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("channels.list.errorDelete"));
    } finally {
      setPendingDeleteId(null);
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-0.5 px-2 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-md px-2.5 py-2.5">
            <div className="h-9 w-9 shrink-0 rounded-lg skeleton-shimmer" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 skeleton-shimmer" />
                <div className="h-2.5 w-6 skeleton-shimmer" />
              </div>
              <div className="h-2.5 w-40 skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="m-2 flex flex-col items-center gap-3 rounded-lg border border-critical-strong bg-critical-strong/5 px-4 py-8 text-center">
        <p className="text-caption text-critical">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void fetchConversations();
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-critical-strong bg-critical/10 px-3 py-1.5 text-caption-bold text-critical transition-colors hover:bg-critical-strong/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <RefreshCw className="h-3 w-3" />
          {t("channels.list.retry")}
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="mx-2 mt-1 rounded-md border border-dashed border-hairline-soft bg-surface-soft px-3 py-4 text-center">
        <p className="text-caption-bold text-steel">{t("channels.list.emptyTitle")}</p>
        <p className="mt-0.5 text-micro leading-normal text-stone">
          {t("channels.list.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        variants={channelsListContainer}
        initial="hidden"
        animate="show"
        className="space-y-0.5 px-2 py-1.5"
      >
        {actionError && (
          <div className="mx-0.5 mb-2 rounded-md border border-critical-strong bg-critical-strong/5 px-3 py-2 text-caption text-critical">
            {actionError}
          </div>
        )}

        {conversations.map((conv) => {
          const isSelected = conv.conversation_id === selectedConversationId;
          const name = conv.display_name ?? conv.provider_chat_id;
          const initial = name.charAt(0).toUpperCase();
          const providerColor = getProviderColor(conv.provider);
          const relTime = formatRelativeTime(conv.last_message_at, locale, t);

          return (
            <motion.div
              key={conv.conversation_id}
              variants={channelsListItem}
              className={cn(
                "group relative flex w-full items-center rounded-md text-left transition-colors duration-150",
                isSelected
                  ? "bg-surface-soft text-ink-deep"
                  : "text-ink-deep hover:bg-sidebar-hover",
                deletingId === conv.conversation_id && "pointer-events-none opacity-50",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(conv)}
                className="flex w-full flex-1 items-center gap-3 rounded-md px-2.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <div
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-body-sm-bold text-on-cobalt shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  style={{ background: `linear-gradient(135deg, ${providerColor}cc, ${providerColor})` }}
                >
                  {initial}
                  {conv.session_active && (
                    <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-2.5 w-2.5">
                      <span className="absolute inset-0 rounded-full bg-accent-emerald/40 animate-ping" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-emerald ring-2 ring-sidebar-bg" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-body-sm-bold text-ink-deep">
                      {name}
                    </span>
                    {relTime && (
                      <span className="shrink-0 tabular-nums text-micro font-medium text-stone">
                        {relTime}
                      </span>
                    )}
                  </div>
                  {conv.last_message ? (
                    <p className="mt-0.5 truncate text-caption text-steel">
                      {conv.last_message}
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-caption text-stone">
                      — {t("channels.list.newConversation")}
                    </p>
                  )}
                </div>
              </button>

              <div className="fine-hover-action shrink-0 pr-1.5 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t("channels.list.deleteConversation")}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-stone hover:bg-canvas hover:text-ink-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="min-w-[10rem]">
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        setPendingDeleteId(conv.conversation_id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      {t("channels.list.deleteConversation")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {isSelected && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1.5 left-0 w-[2px] rounded-r-full bg-border-strong"
                />
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("channels.list.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("channels.list.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("channels.list.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>
              {t("channels.list.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
