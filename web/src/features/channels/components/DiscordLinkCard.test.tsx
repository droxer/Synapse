import { describe, expect, it, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "en",
  }),
}));

jest.mock("../api/channel-api", () => ({
  createLinkToken: jest.fn(),
  deleteDiscordBotConfig: jest.fn(),
  getChannelStatus: jest.fn(),
  listChannelAccounts: jest.fn(),
  saveDiscordBotConfig: jest.fn(),
  unlinkChannelAccount: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DiscordLinkCard } = require("./DiscordLinkCard");

describe("DiscordLinkCard modal-only rendering", () => {
  it("renders nothing while hidden and closed, including the loading skeleton", () => {
    const html = renderToStaticMarkup(
      <DiscordLinkCard hideCard open={false} onOpenChange={() => undefined} />,
    );

    expect(html).toBe("");
    expect(html).not.toContain("skeleton-shimmer");
  });
});
