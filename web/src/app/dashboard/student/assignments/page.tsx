import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StudentAssignmentsClient } from "@/components/student/student-assignments-client";
import { getStudentAssignments } from "@/lib/student-assignments";

export default async function StudentAssignmentsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookieStore.getAll() } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");
  return <StudentAssignmentsClient assignments={await getStudentAssignments(session.access_token)} />;
}
