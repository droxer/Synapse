import { describe, expect, it } from "@jest/globals";
import type { ChannelConversation } from "../api/channel-api";
import {
  resolveChannelsPane,
  resolveSelectedConversation,
  shouldShowChannelsHeader,
  shouldShowThreadList,
  sortChannelConversations,
} from "./channels-page-state";

const olderConversation: ChannelConversation = {
  conversation_id: "conversation-1",
  provider: "telegram",
  display_name: "Older chat",
  provider_chat_id: "chat-1",
  last_message: "older",
  last_message_at: "2026-04-18T10:00:00.000Z",
  session_active: false,
};

const newerConversation: ChannelConversation = {
  conversation_id: "conversation-2",
  provider: "telegram",
  display_name: "Newer chat",
  provider_chat_id: "chat-2",
  last_message: "newer",
  last_message_at: "2026-04-18T11:00:00.000Z",
  session_active: true,
};

describe("channels page state helpers", () => {
  it("sorts conversations newest-first for the split list", () => {
    expect(
      sortChannelConversations([olderConversation, newerConversation]).map(
        (conversation) => conversation.conversation_id,
      ),
    ).toEqual(["conversation-2", "conversation-1"]);
  });

  it("preserves the current selection when the conversation still exists after refresh", () => {
    const sorted = sortChannelConversations([olderConversation, newerConversation]);

    expect(
      resolveSelectedConversation(sorted, "conversation-1")?.conversation_id,
    ).toBe("conversation-1");
  });

  it("falls back to the newest conversation when a refresh introduces the first thread", () => {
    expect(resolveSelectedConversation([], null)).toBeNull();

    const sorted = sortChannelConversations([newerConversation]);
    expect(resolveSelectedConversation(sorted, null)?.conversation_id).toBe(
      "conversation-2",
    );
  });

  it("falls back to the newest remaining conversation when the selected one was deleted", () => {
    const sorted = sortChannelConversations([newerConversation]);

    expect(
      resolveSelectedConversation(sorted, "conversation-1")?.conversation_id,
    ).toBe("conversation-2");
  });

  it("shows the thread list only when there are two or more conversations", () => {
    expect(shouldShowThreadList(0)).toBe(false);
    expect(shouldShowThreadList(1)).toBe(false);
    expect(shouldShowThreadList(2)).toBe(true);
  });

  it("uses focus layout on desktop for zero or one conversation", () => {
    expect(
      resolveChannelsPane({
        isMobile: false,
        mobileChatOpen: false,
        hasSelectedConversation: true,
        conversationCount: 1,
      }),
    ).toBe("focus");

    expect(
      resolveChannelsPane({
        isMobile: false,
        mobileChatOpen: false,
        hasSelectedConversation: false,
        conversationCount: 0,
      }),
    ).toBe("focus");
  });

  it("keeps desktop on the split pane when multiple threads exist", () => {
    expect(
      resolveChannelsPane({
        isMobile: false,
        mobileChatOpen: false,
        hasSelectedConversation: true,
        conversationCount: 2,
      }),
    ).toBe("split");
  });

  it("opens chat directly on mobile for a single thread", () => {
    expect(
      resolveChannelsPane({
        isMobile: true,
        mobileChatOpen: false,
        hasSelectedConversation: true,
        conversationCount: 1,
      }),
    ).toBe("chat");
  });

  it("shows listening on mobile when there are no threads", () => {
    expect(
      resolveChannelsPane({
        isMobile: true,
        mobileChatOpen: false,
        hasSelectedConversation: false,
        conversationCount: 0,
      }),
    ).toBe("focus");
  });

  it("shows only the thread list on mobile when multiple threads exist", () => {
    expect(
      resolveChannelsPane({
        isMobile: true,
        mobileChatOpen: false,
        hasSelectedConversation: true,
        conversationCount: 2,
      }),
    ).toBe("thread_list");
  });

  it("shows only the chat pane on mobile after selecting a thread", () => {
    expect(
      resolveChannelsPane({
        isMobile: true,
        mobileChatOpen: true,
        hasSelectedConversation: true,
        conversationCount: 2,
      }),
    ).toBe("chat");
  });

  it("hides the page header only for the mobile chat pane", () => {
    expect(shouldShowChannelsHeader("chat")).toBe(false);
    expect(shouldShowChannelsHeader("thread_list")).toBe(true);
    expect(shouldShowChannelsHeader("split")).toBe(true);
    expect(shouldShowChannelsHeader("focus")).toBe(true);
  });
});
