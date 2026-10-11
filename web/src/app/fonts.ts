import localFont from "next/font/local";

// Sans text (Latin + CJK) uses the native system stack in globals.css, matching
// eveland.ai — no web font download. Only the mono face is bundled.
export const geistMono = localFont({
  src: "./font-assets/geist-mono-variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});
