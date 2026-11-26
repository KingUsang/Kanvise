import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3001");
});

import { POST } from "./route";

function request(headers: Record<string, string>) {
  return new Request("http://localhost/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ suggestion: "More mocks" }),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/suggestions (DEV-PUB-004)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("KANVISE_PROXY_SECRET", "");
  });

  it("sends no client address when the proxy secret is unset", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({}, { status: 201 }));
    await POST(request({ "x-real-ip": "1.2.3.4" }));
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("forwards the Vercel visitor address with the proxy secret", async () => {
    vi.stubEnv("KANVISE_PROXY_SECRET", "proxy-secret-0123456789");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({}, { status: 201 }));
    await POST(request({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }));
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
      "X-Kanvise-Client-Ip": "1.2.3.4",
      "X-Kanvise-Proxy-Secret": "proxy-secret-0123456789",
    });
  });
});
