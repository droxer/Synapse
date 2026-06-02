/**
 * Resolve the FastAPI backend base URL for server-side Next.js code.
 *
 * Priority:
 * 1. BACKEND_URL — explicit override (web/.env.local)
 * 2. PORT — typically synced from backend/.env via next.config.ts
 * 3. Default http://127.0.0.1:8000
 */
export function resolveBackendUrl(): string {
  const explicit = process.env.BACKEND_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const port = process.env.PORT?.trim() || "8000";
  const host = process.env.BACKEND_HOST?.trim() || "127.0.0.1";
  return `http://${host}:${port}`;
}
