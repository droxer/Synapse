import { describe, expect, it } from "@jest/globals";
import { faviconAssetsForTheme } from "@/shared/lib/theme-favicon";

describe("theme-favicon", () => {
  it("maps resolved themes to favicon assets", () => {
    expect(faviconAssetsForTheme("dark")).toEqual({
      icon: "/favicon-dark.svg",
      apple: "/apple-touch-icon-dark.png",
    });
    expect(faviconAssetsForTheme("light")).toEqual({
      icon: "/favicon-light.svg",
      apple: "/apple-touch-icon.png",
    });
  });
});
