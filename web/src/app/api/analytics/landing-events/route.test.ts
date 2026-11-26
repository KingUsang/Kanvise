import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3001");
});

import { POST } from "./route";

describe("POST /api/analytics/landing-events (DEV-PUB-004)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("KANVISE_PROXY_SECRET", "");
  });

  it("does not forward the caller's X-Forwarded-For", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));
    const incoming = new Request("http://localhost/api/analytics/landing-events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "6.6.6.6" },
      body: "{}",
    }) as unknown as Parameters<typeof POST>[0];

    expect((await POST(incoming)).status).toBe(204);
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("forwards the visitor address with the proxy secret when configured", async () => {
    vi.stubEnv("KANVISE_PROXY_SECRET", "proxy-secret-0123456789");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));
    const incoming = new Request("http://localhost/api/analytics/landing-events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "1.2.3.4" },
      body: "{}",
    }) as unknown as Parameters<typeof POST>[0];

    await POST(incoming);

    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
      "X-Kanvise-Client-Ip": "1.2.3.4",
      "X-Kanvise-Proxy-Secret": "proxy-secret-0123456789",
    });
  });
});
