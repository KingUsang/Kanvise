import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckoutButton } from "../../../components/public/checkout-button";

async function getProgramme(slug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/public/programmes/${slug}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch programme");
  }

  const json = await res.json();
  return json.data;
}

export default async function ProgrammePage({
  params,
}: {
  params: Promise<{ school: string; programmeSlug: string }>;
}) {
  const { school: schoolSlug, programmeSlug } = await params;
  const data = await getProgramme(programmeSlug);

  if (!data) notFound();

  const { programme, school, sub_programmes = [], courses = [], tutor } = data;
  const price = Number(programme.price || 0);
  const itemCount = sub_programmes.length + courses.length;

  return (
    <div className="min-h-screen bg-[#fbf9f8] text-[#1b1c1c]">
      <header className="sticky top-0 z-40 border-b border-[#e4e2e1] bg-[#fbf9f8]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link href={`/${schoolSlug}`} className="flex items-center gap-2 text-sm font-semibold text-[#2e2877]">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            {school?.name || "All programmes"}
          </Link>
          <Link href="#enrol" className="rounded-lg bg-[#994704] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#753400]">
            Enrol
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-[#e4e2e1] bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_360px] lg:px-8 lg:py-16">
            <div className="max-w-3xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Programme</p>
              <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-[-0.03em] text-[#2e2877] md:text-5xl">
                {programme.name}
              </h1>
              {programme.description && (
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#474551]">{programme.description}</p>
              )}
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#474551]">
                {itemCount > 0 && (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[19px] text-[#994704]">menu_book</span>
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                )}
                {tutor && (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[19px] text-[#994704]">person</span>
                    Led by {tutor.first_name} {tutor.last_name}
                  </span>
                )}
              </div>
            </div>

            <aside id="enrol" className="h-fit rounded-xl border border-[#c8c5d2] bg-[#fbf9f8] p-6 shadow-sm lg:sticky lg:top-24">
              <p className="text-sm font-medium text-[#474551]">Programme fee</p>
              <p className="mt-2 text-3xl font-bold text-[#2e2877]">₦{price.toLocaleString()}</p>
              <div className="my-6 border-t border-[#e4e2e1]" />
              <CheckoutButton
                schoolSlug={schoolSlug}
                programmeId={programme.id}
                price={price}
                programmeSlug={programmeSlug}
              />
              <p className="mt-3 text-center text-xs leading-5 text-[#6a6874]">
                You’ll be asked to sign in or create a student account before payment.
              </p>
            </aside>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 lg:grid-cols-[1fr_300px] lg:px-8 lg:py-16">
          <div>
            {itemCount > 0 && (
              <section id="curriculum">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Curriculum</p>
                    <h2 className="mt-2 text-2xl font-bold text-[#2e2877]">What’s included</h2>
                  </div>
                  <span className="text-sm text-[#6a6874]">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
                </div>

                <div className="divide-y divide-[#e4e2e1] rounded-xl border border-[#e4e2e1] bg-white">
                  {sub_programmes.map((sub: any) => (
                    <div key={`sub-${sub.id}`} className="flex gap-4 p-5">
                      <span className="material-symbols-outlined mt-0.5 text-[#994704]">folder_open</span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#1b1c1c]">{sub.name}</h3>
                        {sub.description && <p className="mt-1 text-sm leading-6 text-[#6a6874]">{sub.description}</p>}
                      </div>
                    </div>
                  ))}
                  {courses.map((course: any) => (
                    <div key={`course-${course.id}`} className="flex gap-4 p-5">
                      <span className="material-symbols-outlined mt-0.5 text-[#994704]">play_lesson</span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#1b1c1c]">{course.name}</h3>
                        {course.description && <p className="mt-1 text-sm leading-6 text-[#6a6874]">{course.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {tutor && (
              <section id="tutor" className="mt-14 border-t border-[#e4e2e1] pt-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Instructor</p>
                <div className="mt-4 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2e2877] text-sm font-bold text-white">
                    {tutor.first_name?.[0]}{tutor.last_name?.[0]}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#2e2877]">{tutor.first_name} {tutor.last_name}</h2>
                    {tutor.bio && <p className="mt-2 max-w-2xl leading-7 text-[#474551]">{tutor.bio}</p>}
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 border-l border-[#e4e2e1] pl-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6a6874]">On this page</p>
              <nav className="mt-4 space-y-3 text-sm">
                {itemCount > 0 && <a href="#curriculum" className="block text-[#474551] hover:text-[#2e2877]">What’s included</a>}
                {tutor && <a href="#tutor" className="block text-[#474551] hover:text-[#2e2877]">Instructor</a>}
                <a href="#enrol" className="block font-semibold text-[#994704]">Enrol</a>
              </nav>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-[#e4e2e1] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-[#6a6874] sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>{school?.name || "Kanvise"}</span>
          <Link href={`/${schoolSlug}`} className="hover:text-[#2e2877]">View all programmes</Link>
        </div>
      </footer>
    </div>
  );
}
