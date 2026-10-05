import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 4_096)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });

    const response = await fetch(`${API_URL}/analytics/landing-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": request.headers.get("x-forwarded-for") || "",
      },
      body: raw,
      signal: AbortSignal.timeout(5_000),
    });

    if (response.status === 204) return new NextResponse(null, { status: 204 });
    const payload = await response
      .json()
      .catch(() => ({ error: "Analytics request failed" }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    // Analytics must never interfere with the visitor's landing-page journey.
    return new NextResponse(null, { status: 204 });
  }
}
