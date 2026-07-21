import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Server missing Supabase environment configuration" },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { error } = await supabase.from("waitlist_signups").insert([
      {
        contact_name: contactName,
        contact_email: contactEmail,
        centre_name: centreName,
        contact_phone: body.contact_phone?.trim() || null,
        estimated_student_count: estimatedStudentCount,
        wants_beta_testing: Boolean(body.wants_beta_testing),
        status: "pending",
      },
    ]);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "You're already on the list! We will be in touch soon." },
          { status: 409 }
        );
      }

      console.error("[Waitlist Route] Failed to insert waitlist signup:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Successfully joined the waitlist!" }, { status: 201 });
  } catch (error) {
    console.error("[Waitlist Route] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to process waitlist request. Please try again later." },
      { status: 500 }
    );
  }
}
