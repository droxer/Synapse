"use client";

import { inter, geistMono, notoSansSC, notoSansTC } from "./fonts";
import { Button } from "@/shared/components/ui/button";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${notoSansSC.variable} ${notoSansTC.variable}`}
    >
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="flex h-screen w-screen items-center justify-center">
          <div className="flex w-full max-w-[28rem] flex-col items-center gap-4 px-6 text-center">
            <h1 className="w-full text-heading-sm text-foreground">
              Something went wrong
            </h1>
            <p className="w-full text-body-sm text-muted-foreground">
              {error.message || "A critical error occurred."}
            </p>
            <Button onClick={reset}>
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
