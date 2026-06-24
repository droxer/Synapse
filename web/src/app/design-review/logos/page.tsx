import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { LogoComparison } from "@/shared/components/LogoComparison";

export default function LogoReviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main id="main" className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/60 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/design-system"
            className="inline-flex items-center gap-2 text-body-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Design system
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Logo review</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Compare all logo directions side by side, then pick one to ship as the primary mark.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <LogoComparison />
      </section>
    </main>
  );
}
