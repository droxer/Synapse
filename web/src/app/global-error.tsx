"use client";

import { useEffect } from "react";
import { montserrat, geistMono, notoSansSC, notoSansTC } from "./fonts";
import { Button } from "@/shared/components/ui/button";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Root providers are unmounted here, so re-apply the persisted theme (default dark, matching ThemeProvider). */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('theme');var d=!t||t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error);
  }, [error]);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${montserrat.variable} ${geistMono.variable} ${notoSansSC.variable} ${notoSansTC.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="flex h-screen w-screen items-center justify-center">
          <div className="flex w-full max-w-[28rem] flex-col items-center gap-4 px-6 text-center">
            <h1 className="w-full text-balance text-heading-sm text-foreground">
              Something went wrong
            </h1>
            <p className="w-full text-body-sm text-muted-foreground">
              A critical error occurred. Try again, or reload the page.
            </p>
            <Button onClick={reset}>
              Try Again
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
