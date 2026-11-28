import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";

export const metadata = { title: "Welcome to Kanvise" };

/** ONB-01 to ONB-11: full page with no sidebar, for a signed-in account owner. */
export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/onboarding");

  // app_metadata is server-controlled; user_metadata only supplies the name.
  const role = user.app_metadata?.kanvise_role || user.app_metadata?.role || "student";
  if (role !== "admin") redirect("/dashboard");
  if (!user.app_metadata?.school_id) redirect("/dashboard/school-setup");

  const firstName = String(user.user_metadata?.first_name || "").trim();
  return <OnboardingGate firstName={firstName} />;
}
