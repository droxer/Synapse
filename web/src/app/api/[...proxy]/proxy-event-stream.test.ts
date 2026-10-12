import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { proxyEventStream } from "./proxy-event-stream";

describe("proxyEventStream", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn<typeof fetch>(async () =>
      new Response("event: done\ndata: {}\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Transfer-Encoding": "chunked" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("forwards the client abort signal so closing the EventSource closes the upstream stream", async () => {
    const controller = new AbortController();

    await proxyEventStream("http://backend/conversations/abc/events", "GET", new Headers(), controller.signal);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBe(controller.signal);
  });

  it("returns an unbuffered event-stream response", async () => {
    const response = await proxyEventStream(
      "http://backend/conversations/abc/events",
      "GET",
      new Headers(),
      new AbortController().signal,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("transfer-encoding")).toBeNull();
  });
});
