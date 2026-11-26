import { NextRequest, NextResponse } from "next/server";
import { proxyClientHeaders } from "@/lib/server/proxy-client-headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.arrayBuffer();
    const contentType = req.headers.get("content-type");
    const headers: Record<string, string> = {
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...proxyClientHeaders(req),
    };
    const response = await fetch(`${API_URL}/waitlist`, {
      method: "POST",
      ...(Object.keys(headers).length ? { headers } : {}),
      body,
      signal: AbortSignal.timeout(15_000),
    });

    const responseHeaders = new Headers();
    const upstreamContentType = response.headers.get("content-type");
    if (upstreamContentType) responseHeaders.set("content-type", upstreamContentType);
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[Waitlist Route] Failed to reach API:", error);
    return NextResponse.json(
      { error: "Failed to process waitlist request. Please try again later." },
      { status: 502 },
    );
  }
}
