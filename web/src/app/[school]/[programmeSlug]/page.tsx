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

  const { programme, school, sub_programmes = [], courses = [], tutors = [] } = data;
  const directCourses = courses.filter((course: any) => !course.sub_programme_id);
  const price = Number(programme.price || 0);
  const itemCount = courses.length;
  const currency = programme.currency || "NGN";
  const isFree = price === 0;
  const formatPrice = (value: number) => value === 0 ? "Free" : new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <div className="min-h-screen bg-[#fbf9f8] text-[#1b1c1c]">
      <header className="sticky top-0 z-40 border-b border-[#e4e2e1] bg-[#fbf9f8]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link href={`/${schoolSlug}`} className="flex items-center gap-2 text-sm font-semibold text-[#2e2877]">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            {school?.logo_url ? (
              <img src={school.logo_url} alt="" className="h-7 w-7 rounded object-contain" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded bg-[#2e2877] text-[10px] font-bold text-white">
                {(school?.name || "K").slice(0, 2).toUpperCase()}
              </span>
            )}
            <span>{school?.name || "All programmes"}</span>
          </Link>
          <Link href="#enrol" className="rounded-lg bg-[#994704] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#753400]">
            {isFree ? "Enrol for free" : "Enrol now"}
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
              {programme.thumbnail_url && (
                <img
                  src={programme.thumbnail_url}
                  alt=""
                  className="mt-6 aspect-[16/6] w-full max-w-2xl rounded-lg border border-[#e4e2e1] object-cover"
                />
              )}
              {programme.description && (
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#474551]">{programme.description}</p>
              )}
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#474551]">
                {itemCount > 0 && (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[19px] text-[#994704]">menu_book</span>
                    {itemCount} {itemCount === 1 ? "subject" : "subjects"}
                  </span>
                )}
                {tutors.length > 0 && (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[19px] text-[#994704]">person</span>
                    {tutors.length} {tutors.length === 1 ? "instructor" : "instructors"}
                  </span>
                )}
              </div>
            </div>

            <aside id="enrol" className="h-fit rounded-xl border border-[#c8c5d2] bg-[#fbf9f8] p-6 shadow-sm lg:sticky lg:top-24">
              <p className="text-sm font-medium text-[#474551]">{isFree ? "Free programme" : "Programme fee"}</p>
              <p className="mt-2 text-3xl font-bold text-[#2e2877]">{formatPrice(price)}</p>
              <div className="my-6 border-t border-[#e4e2e1]" />
              <CheckoutButton
                schoolSlug={schoolSlug}
                programmeId={programme.id}
                price={price}
                programmeSlug={programmeSlug}
              />
              <p className="mt-3 text-center text-xs leading-5 text-[#6a6874]">
                {isFree ? "Create a student account or sign in to start learning." : "You’ll be asked to sign in or create a student account before payment."}
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
                    <h2 className="mt-2 text-2xl font-bold text-[#2e2877]">Subjects included</h2>
                  </div>
                  <span className="text-sm text-[#6a6874]">{itemCount} {itemCount === 1 ? "subject" : "subjects"}</span>
                </div>

                <div className="divide-y divide-[#e4e2e1] rounded-xl border border-[#e4e2e1] bg-white">
                  {directCourses.map((course: any) => (
                    <div key={`course-${course.id}`} className="flex gap-4 p-5">
                      <span className="material-symbols-outlined mt-0.5 text-[#994704]">play_lesson</span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#1b1c1c]">{course.name}</h3>
                        {course.description && <p className="mt-1 text-sm leading-6 text-[#6a6874]">{course.description}</p>}
                      </div>
                    </div>
                  ))}
                  {sub_programmes.map((sub: any) => sub.courses?.map((course: any) => (
                    <div key={`course-${course.id}`} className="flex gap-4 p-5">
                      <span className="material-symbols-outlined mt-0.5 text-[#994704]">play_lesson</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6a6874]">{sub.name}</p>
                        <h3 className="mt-1 font-semibold text-[#1b1c1c]">{course.name}</h3>
                        {course.description && <p className="mt-1 text-sm leading-6 text-[#6a6874]">{course.description}</p>}
                      </div>
                    </div>
                  )))}
                </div>
              </section>
            )}

            {tutors.length > 0 && (
              <section id="tutor" className="mt-14 border-t border-[#e4e2e1] pt-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Instructor</p>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  {tutors.map((tutor: any) => (
                    <div key={tutor.id} className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2e2877] text-sm font-bold text-white">
                        {tutor.profile_photo_url ? <img src={tutor.profile_photo_url} alt="" className="h-full w-full object-cover" /> : `${tutor.first_name?.[0] || ""}${tutor.last_name?.[0] || ""}`}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-[#2e2877]">{tutor.first_name} {tutor.last_name}</h2>
                        {tutor.bio && <p className="mt-2 leading-7 text-[#474551]">{tutor.bio}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 border-l border-[#e4e2e1] pl-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6a6874]">On this page</p>
              <nav className="mt-4 space-y-3 text-sm">
                {itemCount > 0 && <a href="#curriculum" className="block text-[#474551] hover:text-[#2e2877]">Subjects included</a>}
                {tutors.length > 0 && <a href="#tutor" className="block text-[#474551] hover:text-[#2e2877]">Instructor</a>}
                <a href="#enrol" className="block font-semibold text-[#994704]">{isFree ? "Enrol for free" : "Enrol now"}</a>
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
