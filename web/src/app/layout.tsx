import type { Metadata } from "next";
import Script from "next/script";
import { inter, geistMono, notoSansSC, notoSansTC } from "./fonts";
import { Providers } from "./providers";
import { THEME_FAVICON_BOOTSTRAP } from "@/shared/lib/theme-favicon-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synapse",
  description: "Synapse - Intelligent AI Agent Platform",
  icons: {
    icon: { url: "/favicon-dark.svg", type: "image/svg+xml" },
    apple: { url: "/apple-touch-icon-dark.png", sizes: "180x180", type: "image/png" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} ${notoSansSC.variable} ${notoSansTC.variable}`}
    >
      <head>
        <Script id="sync-theme-favicon" strategy="beforeInteractive">
          {THEME_FAVICON_BOOTSTRAP}
        </Script>
        <Script id="sync-locale-lang" strategy="beforeInteractive">
          {`(function(){try{var l=localStorage.getItem('i18n:locale');if(l)document.documentElement.lang=l;}catch(e){}})();`}
        </Script>
      </head>
      <body className="font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-button-md focus:text-primary-foreground">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
