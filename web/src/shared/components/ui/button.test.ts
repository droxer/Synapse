import { describe, expect, it } from "@jest/globals";
import { buttonVariants } from "./button";

describe("buttonVariants", () => {
  it("default uses the cobalt primary fill with token hover/active states", () => {
    const c = buttonVariants({ variant: "default" });
    expect(c).toContain("bg-primary");
    expect(c).toContain("text-primary-foreground");
    expect(c).toContain("hover:bg-cobalt-deep");
    expect(c).toContain("active:bg-cobalt-selected");
  });
  it("secondary is a borderless tonal surface", () => {
    const c = buttonVariants({ variant: "secondary" });
    expect(c).toContain("bg-secondary");
    expect(c).not.toMatch(/(^|\s)border(\s|$)/);
  });
  it("ghost is transparent with muted hover", () => {
    const c = buttonVariants({ variant: "ghost" });
    expect(c).toContain("bg-transparent");
    expect(c).toContain("hover:bg-muted");
  });
  it("destructive uses the critical fill with AA-safe foreground", () => {
    const c = buttonVariants({ variant: "destructive" });
    expect(c).toContain("bg-critical");
    expect(c).toContain("text-on-destructive");
  });
  it("marketing is the black ink pill", () => {
    const c = buttonVariants({ variant: "marketing" });
    expect(c).toContain("bg-ink-button");
    expect(c).toContain("text-on-ink-button");
  });
  it("link uses primary text and no solid fill", () => {
    const c = buttonVariants({ variant: "link" });
    expect(c).toContain("text-primary");
    expect(c).not.toMatch(/\bbg-primary\b/);
  });
  it("text buttons are pill-shaped", () => {
    for (const variant of ["default", "secondary", "ghost", "destructive", "marketing"] as const) {
      expect(buttonVariants({ variant })).toContain("rounded-full");
      expect(buttonVariants({ variant })).not.toContain("rounded-md");
    }
  });
  it("icon sizes are circles", () => {
    for (const size of ["icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
      expect(buttonVariants({ size })).toContain("rounded-circle");
    }
  });
});
