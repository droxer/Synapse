import { NextResponse } from "next/server";

/**
 * Stream an SSE response from the backend back to the browser.
 *
 * The client's abort signal is forwarded so that closing the EventSource
 * also closes the upstream connection; otherwise the backend keeps a dead
 * stream reading from the conversation's shared event queue.
 */
export async function proxyEventStream(
  url: string,
  method: string,
  headers: Headers,
  signal: AbortSignal,
): Promise<NextResponse> {
  const backendResponse = await fetch(url, {
    method,
    headers,
    signal,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  // Forward upstream headers, override streaming-specific ones
  const sseHeaders = new Headers(backendResponse.headers);
  sseHeaders.delete("transfer-encoding");
  sseHeaders.set("Content-Type", "text/event-stream");
  sseHeaders.set("Cache-Control", "no-cache");
  sseHeaders.set("Connection", "keep-alive");
  sseHeaders.set("X-Accel-Buffering", "no");

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: sseHeaders,
  });
}
