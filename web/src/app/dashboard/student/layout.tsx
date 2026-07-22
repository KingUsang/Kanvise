import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { getStudentDashboard } from "@/lib/student-dashboard";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookieStore.getAll() } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const data = await getStudentDashboard(session.access_token);
  const name = [data.student.first_name, data.student.last_name].filter(Boolean).join(" ") || "Student";

  return <StudentShell studentName={name} schoolName={data.school.name}>{children}</StudentShell>;
}
