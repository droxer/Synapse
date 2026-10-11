"use client";

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "@/i18n";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

interface ErrorFallbackProps {
  readonly message: string | undefined;
  readonly onRetry: () => void;
}

function ErrorFallback({ message, onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-6" role="alert" aria-live="assertive">
      <div className="flex max-w-[28rem] flex-col items-center gap-4 text-center">
        <h1 className="text-heading-sm text-balance text-foreground">
          {t("shared.errorBoundary.title")}
        </h1>
        <p className="text-body-sm text-pretty break-words text-muted-foreground">
          {message || t("shared.errorBoundary.fallback")}
        </p>
        <p className="text-body-sm text-pretty text-muted-foreground">
          {t("shared.errorBoundary.hint")}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry}>{t("shared.errorBoundary.retry")}</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t("shared.errorBoundary.reload")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback message={this.state.error?.message} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
