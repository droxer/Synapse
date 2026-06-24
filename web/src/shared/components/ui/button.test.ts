import { describe, expect, it } from "@jest/globals";
import { buttonVariants } from "./button";

describe("buttonVariants", () => {
  it("default uses the teal primary fill", () => {
    const c = buttonVariants({ variant: "default" });
    expect(c).toContain("bg-primary");
    expect(c).toContain("text-primary-foreground");
  });
  it("secondary is a subtle surface with a border", () => {
    const c = buttonVariants({ variant: "secondary" });
    expect(c).toContain("border");
    expect(c).toContain("bg-secondary");
  });
  it("ghost is transparent with muted hover", () => {
    const c = buttonVariants({ variant: "ghost" });
    expect(c).toContain("bg-transparent");
    expect(c).toContain("hover:bg-muted");
  });
  it("destructive uses the danger token", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
  });
  it("link uses primary text and no solid fill", () => {
    const c = buttonVariants({ variant: "link" });
    expect(c).toContain("text-primary");
    expect(c).not.toMatch(/\bbg-primary\b/);
  });
  it("text buttons are rounded-md, never pill", () => {
    for (const variant of ["default","secondary","ghost","destructive"] as const) {
      expect(buttonVariants({ variant })).toContain("rounded-md");
      expect(buttonVariants({ variant })).not.toContain("rounded-full");
    }
  });
});
