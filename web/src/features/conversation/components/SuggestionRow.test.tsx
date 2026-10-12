import React from "react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { Zap } from "lucide-react";

interface CapturedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  whileTap?: unknown;
  transition?: unknown;
}

const capturedButtonProps = jest.fn((props: CapturedButtonProps) => props);

jest.mock("framer-motion", () => ({
  __esModule: true,
  useReducedMotion: () => false,
  motion: {
    button: (props: CapturedButtonProps) => {
      capturedButtonProps(props);
      const { children, whileTap: _whileTap, transition: _transition, ...rest } = props;
      return <button {...rest}>{children}</button>;
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SuggestionRow } = require("./SuggestionRow");

describe("SuggestionRow", () => {
  beforeEach(() => {
    capturedButtonProps.mockClear();
  });

  it("renders label, prompt preview, and icon as a borderless list row", () => {
    const html = renderToStaticMarkup(
      <SuggestionRow
        label="Prototype a feature"
        prompt="Prototype a focused feature with tests."
        icon={<Zap data-testid="icon" />}
        onClick={jest.fn()}
      />,
    );

    expect(html).toContain("Prototype a feature");
    expect(html).toContain("Prototype a focused feature with tests.");
    expect(html).toContain("data-testid=\"icon\"");
    expect(html).toContain("rounded-md");
    expect(html).toContain("truncate");
    expect(html).not.toMatch(/\bborder\b/);
  });

  it("is disabled when disabled prop is true", () => {
    const html = renderToStaticMarkup(
      <SuggestionRow label="Disabled" prompt="p" onClick={jest.fn()} disabled />,
    );

    expect(html).toContain("disabled");
  });

  it("calls onClick when the row is clicked", () => {
    const handleClick = jest.fn();
    renderToStaticMarkup(<SuggestionRow label="Click me" prompt="p" onClick={handleClick} />);

    const lastProps = capturedButtonProps.mock.results[capturedButtonProps.mock.results.length - 1]?.value as CapturedButtonProps;
    expect(lastProps.onClick).toBe(handleClick);
    (lastProps.onClick as () => void)?.();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders aria-label when provided", () => {
    const html = renderToStaticMarkup(
      <SuggestionRow label="Hint" prompt="p" onClick={jest.fn()} aria-label="fills the message box" />,
    );

    expect(html).toContain('aria-label="fills the message box"');
  });
});
