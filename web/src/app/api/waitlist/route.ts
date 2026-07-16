import { NextRequest, NextResponse } from "next/server";

type WaitlistPayload = {
  contact_name?: string;
  contact_email?: string;
  centre_name?: string;
  contact_phone?: string;
  estimated_student_count?: string | number;
  wants_beta_testing?: boolean;
};

export async function POST(req: NextRequest) {
  let body: WaitlistPayload;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const contactName = body.contact_name?.trim();
  const contactEmail = body.contact_email?.trim();
  const centreName = body.centre_name?.trim();

  if (!contactName || !contactEmail || !centreName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_HONO_API_URL || "http://localhost:3001";

  try {
    const response = await fetch(`${apiUrl}/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        contact_name: contactName,
        contact_email: contactEmail,
        centre_name: centreName,
      }),
    });

    const text = await response.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Waitlist Route] Failed to reach backend API:", error);
    return NextResponse.json(
      { error: "Failed to process waitlist request. Please try again later." },
      { status: 502 }
    );
  }
}
