import { describe, expect, it } from "@jest/globals";
import { cn } from "./utils";

describe("cn", () => {
  it("preserves custom typography role utilities alongside text color utilities", () => {
    expect(cn("block text-heading-md", "text-info")).toBe("block text-heading-md text-info");
    expect(cn("text-button-md", "text-muted-foreground")).toBe("text-button-md text-muted-foreground");
    expect(cn("text-body-sm-bold", "text-foreground")).toBe("text-body-sm-bold text-foreground");
    expect(cn("text-caption-bold", "text-success-text")).toBe("text-caption-bold text-success-text");
  });

  it("merges conflicting typography role utilities and conflicting text color utilities independently", () => {
    expect(cn("text-body-sm text-foreground", "text-heading-sm")).toBe("text-foreground text-heading-sm");
    expect(cn("text-body-sm text-foreground", "text-muted-foreground")).toBe("text-body-sm text-muted-foreground");
  });
});
