"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense } from "react";
import { Logo } from "@/shared/components/Logo";
import { useTranslation } from "@/i18n";

/**
 * Desktop OAuth callback page.
 *
 * Loaded in the system browser after Google OAuth completes.
 * Reads the NextAuth session, then posts the user data to the
 * desktop-token API keyed by the nonce that the Tauri webview
 * is polling.
 */
function CallbackContent() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const nonce = searchParams.get("nonce");
  const deepLinkHref = nonce
    ? `synapse://auth/callback?nonce=${encodeURIComponent(nonce)}`
    : "";
  const [done, setDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const handoffStarted = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user || !nonce) return;
    if (handoffStarted.current) return;
    handoffStarted.current = true;

    const payload = {
      nonce,
    };

    fetch("/api/auth/desktop-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const body = await res.text();
        if (res.ok) {
          setDone(true);
          window.location.href = deepLinkHref;
        } else {
          console.error("[desktop-callback] Handoff failed:", res.status, body);
          setHasError(true);
        }
      })
      .catch((err) => {
        console.error("[desktop-callback] Fetch error:", err);
        setHasError(true);
      });
  }, [deepLinkHref, session, status, nonce]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-panel w-full max-w-[28rem] px-6 py-8 text-center">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <Logo size={48} tone="auto" className="rounded-lg" />
          {status === "loading" && (
            <>
              <div aria-hidden="true" className="h-5 w-5 rounded-full skeleton-shimmer bg-muted" />
              <p className="text-body-sm text-muted-foreground">{t("desktopCallback.verifying")}</p>
            </>
          )}
          {hasError && (
            <p role="alert" className="text-body-sm text-destructive">
              {t("desktopCallback.handoffFailed")}
            </p>
          )}
          {!nonce && status !== "loading" && (
            <p role="alert" className="text-body-sm text-destructive">
              {t("desktopCallback.missingNonce")}
            </p>
          )}
          {done && (
            <>
              <p className="text-body-sm text-muted-foreground">
                {t("desktopCallback.success")}
              </p>
              {deepLinkHref && (
                <a
                  className="rounded-sm text-body-sm-bold text-info underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href={deepLinkHref}
                >
                  {t("desktopCallback.openApp")}
                </a>
              )}
              <p className="text-caption text-text-subtle">
                {t("desktopCallback.closeTab")}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DesktopCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background" aria-busy="true">
          <div aria-hidden="true" className="h-6 w-6 rounded-full skeleton-shimmer bg-muted" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
