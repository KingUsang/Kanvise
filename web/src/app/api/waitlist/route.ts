import { NextRequest, NextResponse } from "next/server";

type WaitlistPayload = {
  contact_name?: string;
  contact_email?: string;
  centre_name?: string;
  contact_phone?: string;
  estimated_student_count?: string | number;
  wants_beta_testing?: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  const estimatedStudentCount =
    typeof body.estimated_student_count === "number"
      ? body.estimated_student_count
      : body.estimated_student_count
        ? Number.parseInt(body.estimated_student_count, 10)
        : null;

  if (!contactName || !contactEmail || !centreName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const atIndex = contactEmail.indexOf("@");
  const dotAfterAt = contactEmail.indexOf(".", atIndex + 2);
  if (atIndex < 1 || dotAfterAt <= atIndex + 1 || dotAfterAt >= contactEmail.length - 1) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (estimatedStudentCount !== null && Number.isNaN(estimatedStudentCount)) {
    return NextResponse.json({ error: "Estimated student count must be a valid number" }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_URL}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_name: contactName,
        contact_email: contactEmail,
        centre_name: centreName,
        contact_phone: body.contact_phone?.trim() || null,
        estimated_student_count: estimatedStudentCount,
        wants_beta_testing: Boolean(body.wants_beta_testing),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[Waitlist Route] Failed to reach API:", error);
    return NextResponse.json(
      { error: "Failed to process waitlist request. Please try again later." },
      { status: 502 }
    );
  }
}
