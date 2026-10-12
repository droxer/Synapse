import { describe, expect, it } from "@jest/globals";
import { buttonVariants } from "./button";

describe("buttonVariants", () => {
  it("default uses the indigo primary fill with token hover/active states", () => {
    const c = buttonVariants({ variant: "default" });
    expect(c).toContain("bg-primary");
    expect(c).toContain("text-primary-foreground");
    expect(c).toContain("hover:bg-indigo-deep");
    expect(c).toContain("active:bg-indigo-selected");
  });
  it("secondary is a borderless tonal surface", () => {
    const c = buttonVariants({ variant: "secondary" });
    expect(c).toContain("bg-secondary");
    expect(c).not.toMatch(/(^|\s)border(\s|$)/);
  });
  it("ghost is transparent with a tonal hover", () => {
    const c = buttonVariants({ variant: "ghost" });
    expect(c).toContain("bg-transparent");
    expect(c).toContain("hover:bg-surface-hover");
  });
  it("destructive uses the critical fill with AA-safe foreground", () => {
    const c = buttonVariants({ variant: "destructive" });
    expect(c).toContain("bg-critical");
    expect(c).toContain("text-on-destructive");
  });
  it("marketing is the ink fill", () => {
    const c = buttonVariants({ variant: "marketing" });
    expect(c).toContain("bg-ink-button");
    expect(c).toContain("text-on-ink-button");
  });
  it("link uses AA-safe info text and no solid fill", () => {
    const c = buttonVariants({ variant: "link" });
    expect(c).toContain("text-info");
    expect(c).not.toMatch(/\bbg-primary\b/);
  });
  it("CTAs use the sharp 4px radius, never pills or 6px+", () => {
    for (const variant of ["default", "secondary", "ghost", "destructive", "marketing"] as const) {
      const c = buttonVariants({ variant });
      expect(c).toContain("rounded-sm");
      expect(c).not.toMatch(/rounded-(md|lg|xl|full)/);
    }
  });
  it("default size is the compact 32px control", () => {
    expect(buttonVariants({})).toContain("h-8");
    expect(buttonVariants({ size: "icon" })).toContain("size-8");
  });
  it("icon sizes are sharp squares, not circles", () => {
    for (const size of ["icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
      const c = buttonVariants({ size });
      expect(c).not.toContain("rounded-circle");
      expect(c).not.toMatch(/rounded-(md|lg|full)/);
    }
  });
});
