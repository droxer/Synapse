import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";

describe("resolveBackendUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BACKEND_URL;
    delete process.env.PORT;
    delete process.env.BACKEND_HOST;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prefers BACKEND_URL when set", async () => {
    process.env.BACKEND_URL = "http://localhost:9000/";
    const { resolveBackendUrl } = await import("./backend-url");
    expect(resolveBackendUrl()).toBe("http://localhost:9000");
  });

  it("derives URL from PORT when BACKEND_URL is unset", async () => {
    process.env.PORT = "9000";
    const { resolveBackendUrl } = await import("./backend-url");
    expect(resolveBackendUrl()).toBe("http://127.0.0.1:9000");
  });

  it("uses BACKEND_HOST with PORT", async () => {
    process.env.PORT = "9000";
    process.env.BACKEND_HOST = "localhost";
    const { resolveBackendUrl } = await import("./backend-url");
    expect(resolveBackendUrl()).toBe("http://localhost:9000");
  });

  it("defaults to port 8000", async () => {
    const { resolveBackendUrl } = await import("./backend-url");
    expect(resolveBackendUrl()).toBe("http://127.0.0.1:8000");
  });
});
