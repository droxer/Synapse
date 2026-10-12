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

jest.mock("./SuggestionRow", () => ({
  __esModule: true,
  SuggestionRow: ({ label, prompt }: { label: string; prompt: string }) => (
    <span data-testid="suggestion-row">{label}|{prompt}</span>
  ),
}));

jest.mock("@/shared/components/ErrorBanner", () => ({
  __esModule: true,
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));

const zhHeading = "让下一个想法成真";
const zhSubtitle = "描述你想要的结果。Synapse 会规划、编写代码，并在沙盒中运行，每一步都实时可见。";

jest.mock("@/i18n", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "welcome.heading": zhHeading,
        "welcome.subtitle": zhSubtitle,
        "welcome.suggestionsLabel": "Start from",
        "welcome.suggestionsRecentLabel": "From your recent work",
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
  it("renders the task heading and subtitle without a brand eyebrow", () => {
    const html = renderToStaticMarkup(<HomeScreen onSubmitTask={jest.fn()} />);

    expect(html).toContain(zhHeading);
    expect(html).toContain(zhSubtitle);
    expect(html).not.toContain("sidebar.brand");
  });

  it("renders default starter rows with prompt previews under a visible label", () => {
    const html = renderToStaticMarkup(<HomeScreen onSubmitTask={jest.fn()} />);

    expect(html).toContain("Start from");
    expect(html).not.toContain("sr-only\">Start from");
    expect(html).toContain("Prototype a feature|Prototype a focused feature");
    expect(html).toContain("Improve this screen");
    expect(html).toContain("Plan the build");
  });

  it("labels generated suggestions as coming from recent work", () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        onSubmitTask={jest.fn()}
        suggestions={[
          { label: "Verify speed", prompt: "Can you verify speed?" },
          { label: "Add tests", prompt: "Can you add tests?" },
          { label: "Review risks", prompt: "What risks remain?" },
        ]}
      />,
    );

    expect(html).toContain("From your recent work");
    expect(html).toContain("Verify speed|Can you verify speed?");
    expect(html).toContain("Add tests");
    expect(html).toContain("Review risks");
    expect(html).not.toContain("Prototype a feature");
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
