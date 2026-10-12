import localFont from "next/font/local";

// Inter Variable (Latin subset, @fontsource-variable/inter 5.x) is the UI face, matching
// Linear. CJK and other scripts fall through to the native stack in globals.css.
export const inter = localFont({
  src: "./font-assets/inter-variable-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const geistMono = localFont({
  src: "./font-assets/geist-mono-variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});
