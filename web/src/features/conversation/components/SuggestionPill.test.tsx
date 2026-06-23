import React from "react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { Zap } from "lucide-react";

interface CapturedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  whileHover?: unknown;
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
      const { children, whileHover: _whileHover, whileTap: _whileTap, transition: _transition, ...rest } = props;
      return <button {...rest}>{children}</button>;
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SuggestionPill } = require("./SuggestionPill");

describe("SuggestionPill", () => {
  beforeEach(() => {
    capturedButtonProps.mockClear();
  });

  it("renders label and icon as a rounded pill button", () => {
    const html = renderToStaticMarkup(
      <SuggestionPill label="Prototype a feature" icon={<Zap data-testid="icon" />} onClick={jest.fn()} />,
    );

    expect(html).toContain("Prototype a feature");
    expect(html).toContain("data-testid=\"icon\"");
    expect(html).toContain("rounded-full");
    expect(html).toContain("min-h-11");
  });

  it("is disabled when disabled prop is true", () => {
    const html = renderToStaticMarkup(
      <SuggestionPill label="Disabled" onClick={jest.fn()} disabled />,
    );

    expect(html).toContain("disabled");
  });

  it("calls onClick when the pill is clicked", () => {
    const handleClick = jest.fn();
    renderToStaticMarkup(<SuggestionPill label="Click me" onClick={handleClick} />);

    const lastProps = capturedButtonProps.mock.results[capturedButtonProps.mock.results.length - 1]?.value as CapturedButtonProps;
    expect(lastProps.onClick).toBe(handleClick);
    (lastProps.onClick as () => void)?.();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders aria-label when provided", () => {
    const html = renderToStaticMarkup(
      <SuggestionPill label="Hint" onClick={jest.fn()} aria-label="fills the message box" />,
    );

    expect(html).toContain('aria-label="fills the message box"');
  });
});
