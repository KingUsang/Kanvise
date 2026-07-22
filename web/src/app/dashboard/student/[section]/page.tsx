import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { notFound } from "next/navigation";

const sectionNames: Record<string, string> = {
  classes: "My classes",
  assignments: "Assignments",
  mocks: "Mocks",
  materials: "Materials",
  progress: "My progress",
  settings: "Settings",
};

export default async function StudentSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const name = sectionNames[section];
  if (!name) notFound();

  return <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
    <Link href="/dashboard/student" className="inline-flex items-center gap-2 text-sm font-medium text-[#2e2877]"><ArrowLeft size={17} />Back to home</Link>
    <section className="mt-6 rounded-2xl border border-[#e5e1dd] bg-white p-8 text-center">
      <BookOpen className="mx-auto text-[#2e2877]" />
      <h1 className="mt-4 text-2xl font-semibold">{name}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#716c76]">This part of the student portal is the next screen being built. Your dashboard data is already live and comes from your school.</p>
    </section>
  </main>;
}
