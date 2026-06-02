"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TelegramLinkCard } from "@/features/channels/components/TelegramLinkCard";
import { ChannelChatView } from "@/features/channels/components/ChannelChatView";
import { ChannelsOnboarding } from "@/features/channels/components/ChannelsOnboarding";
import { ChannelsListening } from "@/features/channels/components/ChannelsListening";
import { ChannelPageHeader } from "@/features/channels/components/ChannelPageHeader";
import { ChannelConversationList } from "@/features/channels/components/ChannelConversationList";
import { getProviderLabel } from "@/features/channels/components/ChannelProviderIcon";
import { getChannelStatus } from "@/features/channels/api/channel-api";
import type { ChannelConversation } from "@/features/channels/api/channel-api";
import { Button } from "@/shared/components/ui/button";
import { useIsMobile } from "@/shared/hooks/use-media-query";
import { useTranslation } from "@/i18n";
import {
  resolveSelectedConversation,
  resolveChannelsPane,
  shouldShowChannelsHeader,
  shouldShowThreadList,
} from "@/features/channels/lib/channels-page-state";


function PageSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-canvas">
      <aside className="hidden w-[320px] shrink-0 flex-col gap-0.5 border-r border-hairline-soft/60 px-2 py-2 md:flex">
        {[1, 2, 3, 4].map((i) => (
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
      </aside>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl skeleton-shimmer" />
          <div className="space-y-2 text-center">
            <div className="mx-auto h-3 w-32 skeleton-shimmer" />
            <div className="mx-auto h-2.5 w-48 skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<ChannelConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationCount, setConversationCount] = useState<number | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const selectedConversation = useMemo(
    () => resolveSelectedConversation(conversations, selectedConversationId),
    [conversations, selectedConversationId],
  );
  const pane = resolveChannelsPane({
    isMobile,
    mobileChatOpen,
    hasSelectedConversation: selectedConversation !== null,
    conversationCount: conversationCount ?? 0,
  });
  const showThreadList = shouldShowThreadList(conversationCount ?? 0);
  const showChannelsHeader = shouldShowChannelsHeader(pane);

  const reloadChannelStatus = useCallback(async () => {
    const statusRes = await getChannelStatus();
    const telegramIsConfigured = statusRes.providers.telegram?.configured ?? false;

    setTelegramConfigured(telegramIsConfigured);
    if (!telegramIsConfigured) {
      setConversations([]);
      setConversationCount(0);
      setSelectedConversationId(null);
      setMobileChatOpen(false);
    } else {
      // Render immediately; ChannelConversationList will refresh the count.
      setConversationCount((current) => current ?? 0);
    }
    setError(null);
  }, []);

  useEffect(() => {
    void reloadChannelStatus().then(() => {
      setError(null);
    }).catch((err) => {
      setConversations([]);
      setConversationCount(0);
      setError(err instanceof Error ? err.message : "Failed to load channels");
    });
  }, [reloadChannelStatus]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshToken((current) => current + 1);
    }, 5000);

    const handleVisibility = () => {
      if (!document.hidden) {
        setRefreshToken((current) => current + 1);
      }
    };

    const handleFocus = () => {
      setRefreshToken((current) => current + 1);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  function handleModalChange(val: boolean) {
    setIsTelegramModalOpen(val);
    if (!val) {
      void reloadChannelStatus()
        .then(() => {
          setRefreshToken((current) => current + 1);
        })
        .catch(() => {});
    }
  }

  const handleConversationsChange = useCallback(
    (nextConversations: ChannelConversation[]) => {
      if (!telegramConfigured) {
        setConversations([]);
        setConversationCount(0);
        setSelectedConversationId(null);
        setMobileChatOpen(false);
        return;
      }

      setConversations(nextConversations);
      setConversationCount(nextConversations.length);
      if (nextConversations.length === 0) {
        setMobileChatOpen(false);
      }
      setSelectedConversationId((current) =>
        resolveSelectedConversation(nextConversations, current)?.conversation_id ?? null,
      );
      setError(null);
    },
    [telegramConfigured],
  );

  const handleConversationDeleted = useCallback(
    (conversationId: string) => {
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setMobileChatOpen(false);
      }
    },
    [selectedConversationId],
  );

  useEffect(() => {
    if (mobileChatOpen && !selectedConversation) {
      setMobileChatOpen(false);
    }
  }, [mobileChatOpen, selectedConversation]);

  const handleSelectConversation = useCallback((conversation: ChannelConversation) => {
    setSelectedConversationId(conversation.conversation_id);
    if (isMobile) {
      setMobileChatOpen(true);
    }
  }, [isMobile]);

  const renderThreadList = () => (
    <aside className="flex w-full min-w-0 shrink-0 flex-col overflow-hidden border-r border-hairline-soft/60 bg-sidebar-bg md:w-auto">
      <div className="px-4 py-3">
        <p className="label-mono text-steel">
          {t("channels.list.title")}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto md:max-h-none">
        <ChannelConversationList
          selectedConversationId={selectedConversation?.conversation_id ?? null}
          onSelect={handleSelectConversation}
          onDeleted={handleConversationDeleted}
          onCountChange={setConversationCount}
          onConversationsChange={handleConversationsChange}
          refreshToken={refreshToken}
        />
      </div>
    </aside>
  );

  function renderChatView(conversation: ChannelConversation, options?: { showMobileBackBar?: boolean }) {
    const providerLabel = getProviderLabel(conversation.provider);
    const showMobileBackBar = options?.showMobileBackBar ?? false;

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {showMobileBackBar && (
          <div className="flex shrink-0 items-center gap-2 border-b border-hairline-soft/60 bg-canvas px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMobileChatOpen(false)}
              className="gap-1.5 text-steel hover:text-ink-deep"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("channels.mobile.backToThreads")}
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm-bold text-ink-deep">
                {conversation.display_name}
              </p>
              <p className="truncate text-caption text-steel">
                {providerLabel}
              </p>
            </div>
          </div>
        )}
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <ChannelChatView
            key={conversation.conversation_id}
            conversation={conversation}
            hideTopBar
          />
        </div>
      </div>
    );
  }

  function renderContent() {
    if (conversationCount === null) {
      return <PageSkeleton />;
    }
    if (!telegramConfigured && !selectedConversation) {
      return <ChannelsOnboarding onConfigureBot={() => setIsTelegramModalOpen(true)} />;
    }

    if (pane === "chat" && selectedConversation) {
      return renderChatView(selectedConversation, { showMobileBackBar: showThreadList });
    }

    if (pane === "thread_list" && showThreadList) {
      return (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {renderThreadList()}
        </div>
      );
    }

    if (pane === "split" && showThreadList) {
      return (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden md:grid-cols-[320px_minmax(0,1fr)] md:grid-rows-1">
          {renderThreadList()}

          <div className="min-h-0 min-w-0 overflow-hidden">
            {selectedConversation ? (
              renderChatView(selectedConversation)
            ) : (
              <ChannelsListening />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {selectedConversation ? (
          renderChatView(selectedConversation)
        ) : (
          <ChannelsListening />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      {showChannelsHeader && (
        <ChannelPageHeader
          telegramConfigured={telegramConfigured}
          conversationCount={conversationCount}
          onOpenSettings={() => setIsTelegramModalOpen(true)}
        />
      )}

      {/* Modal-only: card is hidden, triggered from the header settings button */}
      <TelegramLinkCard
        hideCard
        open={isTelegramModalOpen}
        onOpenChange={handleModalChange}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-critical-strong bg-critical-strong/5 px-4 py-2.5 text-body-sm text-critical">
            {error}
          </div>
        )}
        {renderContent()}
      </div>
    </div>
  );
}
