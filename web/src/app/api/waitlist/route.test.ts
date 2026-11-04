import { describe, expect, it, vi } from "vitest";

import { POST } from "./route";

function request(body: BodyInit) {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/waitlist", () => {
  it("forwards the input unchanged and preserves an upstream success", async () => {
    const input = {
      contact_name: "  Ada Lovelace  ",
      contact_email: " ADA@EXAMPLE.COM ",
      centre_name: "  Bright Centre  ",
      contact_phone: " +234 800 000 0000 ",
      estimated_student_count: "12",
      wants_beta_testing: false,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "joined", position: 4 }), { status: 201 }),
    );

    const response = await POST(request(JSON.stringify(input)));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ message: "joined", position: 4 });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/waitlist",
      expect.objectContaining({ body: JSON.stringify(input) }),
    );
    vi.restoreAllMocks();
  });

  it("preserves an upstream duplicate response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "already joined", position: 2, already_joined: true }), { status: 409 }),
    );

    const response = await POST(request(JSON.stringify({ contact_email: "ada@example.com" })));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ message: "already joined", position: 2, already_joined: true });
    vi.restoreAllMocks();
  });

  it("rejects malformed JSON before contacting the API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(request("not-json"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON payload" });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("maps an unavailable upstream to a safe response", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("connection refused"));

    const response = await POST(request(JSON.stringify({ contact_email: "ada@example.com" })));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Failed to process waitlist request. Please try again later." });
    vi.restoreAllMocks();
  });

  it("maps a non-JSON upstream response to a safe response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("upstream failure", { status: 502 }));

    const response = await POST(request(JSON.stringify({ contact_email: "ada@example.com" })));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Failed to process waitlist request. Please try again later." });
    vi.restoreAllMocks();
  });
});
