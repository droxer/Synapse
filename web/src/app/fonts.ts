import localFont from "next/font/local";
import { Inter } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const geistMono = localFont({
  src: "./font-assets/geist-mono-variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const notoSansSC = localFont({
  src: "./font-assets/noto-sans-sc-variable.otf",
  variable: "--font-noto-sans-sc",
  weight: "100 900",
  display: "swap",
});

export const notoSansTC = localFont({
  src: "./font-assets/noto-sans-tc-variable.otf",
  variable: "--font-noto-sans-tc",
  weight: "100 900",
  display: "swap",
});
