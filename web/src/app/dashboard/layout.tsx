import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // app_metadata is server-controlled and authoritative. user_metadata is a
  // temporary display/redirect fallback for sessions issued before migration.
  const role =
    user.app_metadata?.kanvise_role ||
    user.app_metadata?.role ||
    user.user_metadata?.kanvise_role ||
    "student";
  const schoolId = user.app_metadata?.school_id;

  // Student pages provide their own navigation shell. Avoid loading the
  // admin/tutor dashboard endpoint for a role it was not designed to serve.
  if (role === "student") {
    return <div className="font-sans">{children}</div>;
  }

  const userInfo = {
    first_name: user.user_metadata?.first_name || "",
    last_name: user.user_metadata?.last_name || "",
    role,
  };

  // A new Admin must be able to render the setup screen before a school exists.
  // Middleware confines that session to /dashboard/school-setup.
  if (role === "admin" && !schoolId) {
    return (
      <div className="font-sans">
        <DashboardShell user={userInfo} setupRequired>
          {children}
        </DashboardShell>
      </div>
    );
  }

  return (
    <div className="font-sans">
      <DashboardShell user={userInfo}>{children}</DashboardShell>
    </div>
  );
}
