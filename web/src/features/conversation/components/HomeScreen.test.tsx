import React from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
      variants?: unknown;
    }) => <div {...props}>{children}</div>,
    section: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    }: React.HTMLAttributes<HTMLElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
      variants?: unknown;
    }) => <section {...props}>{children}</section>,
    p: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    }: React.HTMLAttributes<HTMLParagraphElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
      variants?: unknown;
    }) => <p {...props}>{children}</p>,
    h1: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    }: React.HTMLAttributes<HTMLHeadingElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
      variants?: unknown;
    }) => <h1 {...props}>{children}</h1>,
    button: ({
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      transition: _transition,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      whileHover?: unknown;
      whileTap?: unknown;
      transition?: unknown;
    }) => <button {...props}>{children}</button>,
  },
}));

jest.mock("./ChatInput", () => ({
  __esModule: true,
  ChatInput: () => <div data-testid="chat-input" />,
}));

jest.mock("./SuggestionPill", () => ({
  __esModule: true,
  SuggestionPill: ({ label }: { label: string }) => <span data-testid="suggestion-pill">{label}</span>,
}));

jest.mock("@/shared/components/ErrorBanner", () => ({
  __esModule: true,
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));

const zhSubtitle = "描述你想构建的内容。Synapse 会规划、编写代码、在安全的沙盒中运行，并实时回传每一步进展。";

jest.mock("@/i18n", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "sidebar.brand": "Synapse",
        "welcome.heading": "把想法变成可运行的软件",
        "welcome.subtitle": zhSubtitle,
        "welcome.suggestionsLabel": "Suggested starting points",
        "welcome.suggestion.prototype": "Prototype a feature",
        "welcome.suggestion.prototypePrompt": "Prototype a focused feature with polished UI, accessible interactions, edge cases, and tests.",
        "welcome.suggestion.improve": "Improve this screen",
        "welcome.suggestion.improvePrompt": "Improve this screen for accessibility, interaction clarity, responsive layout, and visual polish.",
        "welcome.suggestion.planBuild": "Plan the build",
        "welcome.suggestion.planBuildPrompt": "Plan this build with implementation steps, accessibility checks, tests, and acceptance criteria.",
        "welcome.suggestion.actionHint": "fills the message box",
        "welcome.suggestion.addedStatus": "Prompt added to composer: {label}",
      };
      return translations[key] ?? key;
    },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HomeScreen } = require("./HomeScreen");

describe("HomeScreen", () => {
  it("renders the Studio Desk headline, eyebrow, and subtitle", () => {
    const html = renderToStaticMarkup(<HomeScreen onSubmitTask={jest.fn()} />);

    expect(html).toContain("Synapse");
    expect(html).toContain("把想法变成可运行的软件");
    expect(html).toContain(zhSubtitle);
  });

  it("renders suggestion pills", () => {
    const html = renderToStaticMarkup(<HomeScreen onSubmitTask={jest.fn()} />);

    expect(html).toContain("Prototype a feature");
    expect(html).toContain("Improve this screen");
    expect(html).toContain("Plan the build");
  });

  it("keeps text left-aligned inside the centered content block", () => {
    const html = renderToStaticMarkup(<HomeScreen onSubmitTask={jest.fn()} />);

    expect(html).toContain("text-left");
    expect(html).not.toContain("cjk-safe-centered");
  });

  it("renders the composer", () => {
    const html = renderToStaticMarkup(<HomeScreen onSubmitTask={jest.fn()} />);

    expect(html).toContain('data-testid="chat-input"');
  });
});
