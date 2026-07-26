import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  let body: { suggestion?: string; email?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const suggestion = body.suggestion?.trim();
  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion text is required" }, { status: 400 });
  }
  if (suggestion.length > 2000) {
    return NextResponse.json({ error: "Suggestion is too long" }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_URL}/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestion, email: body.email?.trim() || null }),
      signal: AbortSignal.timeout(15_000),
    });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[Suggestions Route] Failed to reach API:", error);
    return NextResponse.json(
      { error: "Failed to submit suggestion. Please try again later." },
      { status: 502 }
    );
  }
}
