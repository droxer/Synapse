import React from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ChannelsListening } from "./ChannelsListening";

jest.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      createElement("div", props, children),
  },
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        "channels.listening.activeTitle": "Bot is active",
        "channels.listening.activeDescription":
          "Send any message to a connected bot to start a conversation.",
        "channels.listening.openTelegram": "Open Telegram",
        "channels.listening.openTelegramHintPrefix":
          "Search for your bot and send",
        "channels.listening.openDiscord": "Open Discord",
        "channels.listening.openDiscordHintPrefix": "DM your bot and send",
        "channels.listening.manageHint": "Manage Telegram or Discord.",
      };
      return messages[key] ?? key;
    },
  }),
}));

describe("ChannelsListening", () => {
  it("shows Telegram and Discord actions as normal messages instead of /start", () => {
    const html = renderToStaticMarkup(
      createElement(ChannelsListening, {
        onOpenTelegram: jest.fn(),
        onOpenDiscord: jest.fn(),
      }),
    );

    expect(html).toContain("channels.listening.openTelegram");
    expect(html).toContain("channels.listening.openDiscord");
    expect(html).toContain("hello");
    expect(html).not.toContain("/start");
  });
});
