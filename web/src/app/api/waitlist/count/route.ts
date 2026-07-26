import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/waitlist/count`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[Waitlist Count Route] Failed to reach API:", error);
    return NextResponse.json({ error: "Failed to fetch count" }, { status: 502 });
  }
}
