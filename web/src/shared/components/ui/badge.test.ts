import { describe, expect, it } from "@jest/globals";
import { badgeVariants } from "./badge";

describe("badgeVariants", () => {
  it("neutral is the default muted chip", () => {
    expect(badgeVariants({ variant: "neutral" })).toContain("bg-muted");
  });
  it("intent variants use subtle tints with same-hue text", () => {
    expect(badgeVariants({ variant: "success" })).toContain("text-success");
    expect(badgeVariants({ variant: "danger" })).toContain("text-destructive");
    expect(badgeVariants({ variant: "info" })).toContain("text-info");
    expect(badgeVariants({ variant: "accent" })).toContain("text-primary");
  });
  it("every badge stays pill-shaped", () => {
    for (const v of ["neutral","success","warning","danger","info","accent","outline"] as const) {
      expect(badgeVariants({ variant: v })).toContain("rounded-full");
    }
  });
});
