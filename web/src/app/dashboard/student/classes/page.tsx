import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StudentClassesClient } from "@/components/student/student-classes-client";
import { getStudentClasses } from "@/lib/student-classes";

export default async function StudentClassesPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookieStore.getAll() } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");
  const classes = await getStudentClasses(session.access_token);

  return <main className="mx-auto max-w-[1440px] px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
    <header className="mb-7"><p className="text-sm font-medium text-[#994704]">Your learning schedule</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">My classes</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">See classes from every subject you have access to. When a tutor starts a class, the join button will appear here.</p></header>
    <StudentClassesClient classes={classes} />
  </main>;
}
