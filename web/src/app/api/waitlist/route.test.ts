import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

function request(body: BodyInit) {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/waitlist", () => {
  afterEach(() => vi.restoreAllMocks());

  it("forwards the input unchanged and preserves an upstream success", async () => {
    const input = {
      contact_name: "  Ada Lovelace  ",
      contact_email: " ADA@EXAMPLE.COM ",
      centre_name: "  Bright Centre  ",
      contact_phone: " +234 800 000 0000 ",
      estimated_student_count: "12",
      wants_beta_testing: false,
    };
    const upstreamBody = JSON.stringify({ message: "joined", position: 4 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(upstreamBody, {
        status: 201,
        headers: { "content-type": "application/custom+json" },
      }),
    );

    const response = await POST(request(JSON.stringify(input)));

    expect(response.status).toBe(201);
    expect(await response.text()).toBe(upstreamBody);
    expect(response.headers.get("content-type")).toBe("application/custom+json");
    const forwarded = fetchSpy.mock.calls[0]?.[1];
    expect(await new Response(forwarded?.body as BodyInit).text()).toBe(JSON.stringify(input));
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/waitlist",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("preserves an upstream duplicate response", async () => {
    const upstreamBody = JSON.stringify({ message: "already joined", position: 2, already_joined: true });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(upstreamBody, {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await POST(request(JSON.stringify({ contact_email: "ada@example.com" })));

    expect(response.status).toBe(409);
    expect(await response.text()).toBe(upstreamBody);
  });

  it("forwards malformed JSON so Hono owns the validation response", async () => {
    const rawBody = "not-json";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("invalid payload", {
        status: 400,
        headers: { "content-type": "text/plain" },
      }),
    );

    const response = await POST(request(rawBody));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("invalid payload");
    expect(response.headers.get("content-type")).toBe("text/plain");
    const forwarded = fetchSpy.mock.calls[0]?.[1];
    expect(await new Response(forwarded?.body as BodyInit).text()).toBe(rawBody);
  });

  it("maps an unavailable upstream to a safe response", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("connection refused"));

    const response = await POST(request(JSON.stringify({ contact_email: "ada@example.com" })));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Failed to process waitlist request. Please try again later." });
  });

  it("relays a non-JSON upstream response without rebuilding it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("upstream failure", {
      status: 502,
      headers: { "content-type": "text/plain" },
    }));

    const response = await POST(request(JSON.stringify({ contact_email: "ada@example.com" })));

    expect(response.status).toBe(502);
    expect(await response.text()).toBe("upstream failure");
    expect(response.headers.get("content-type")).toBe("text/plain");
  });
});
