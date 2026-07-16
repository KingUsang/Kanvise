import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

async function getSchool(slug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const res = await fetch(`${apiUrl}/public/schools/${slug}`, {
    next: { revalidate: 60 } // Cache for 60 seconds
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch school");
  }
  const json = await res.json();
  return json.data;
}

export default async function SchoolStorefrontPage({ params }: { params: Promise<{ school: string }> }) {
  const resolvedParams = await params;
  const data = await getSchool(resolvedParams.school);
  
  if (!data) {
    notFound();
  }

  const { school, programmes, standalone_courses, tutors } = data;

  return (
    <div className="font-body-md bg-surface antialiased overflow-x-hidden min-h-screen text-on-surface">
      <style dangerouslySetInnerHTML={{ __html: `
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .icon-fill { font-variation-settings: 'FILL' 1; }
      ` }} />

      {/* TopNavBar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface/95 backdrop-blur-sm flex justify-between items-center px-6 md:px-margin-desktop py-4 border-b border-outline-variant transition-all duration-200 ease-in-out font-body-md text-body-md text-primary h-[72px]">
        <div className="flex items-center gap-8">
          <div className="font-headline-md text-headline-md font-bold text-primary">Kanvise</div>
          <nav className="hidden md:flex gap-6">
            <a className="text-primary font-bold border-b-2 border-secondary pb-1 hover:text-secondary transition-colors" href="#">Home</a>
            <a className="text-on-surface-variant hover:text-secondary transition-colors" href="#">Benefits</a>
            <a className="text-on-surface-variant hover:text-secondary transition-colors" href="#">Pricing</a>
            <a className="text-on-surface-variant hover:text-secondary transition-colors" href="#">Programmes</a>
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <Link href="/auth/login" className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors px-4 py-2">
            Login
          </Link>
          <Link href="/auth/login" className="bg-secondary text-on-secondary px-6 py-2 rounded font-label-md text-label-md hover:opacity-90 transition-opacity">
            Get Started
          </Link>
        </div>
        <button className="md:hidden text-primary">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="pt-[72px]">
        {/* Hero Section */}
        <section className="relative w-full h-[500px] md:h-[600px] flex flex-col justify-end pb-margin-desktop">
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center" 
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAXtAL24MjpnOOLbUw8QzJ4Ymi7osvzSIrOWWqLxrBh493wkGM7_JmpaLmg4Ig4jRJn-rKQ3Iw2FEgM-RQPSSRtOxZifRSpPWQNNIpJ_ceWr3qZKR6TzhmTQN97Ihod_X_t2Q3nbC_qjc5rOxEhiVkNpvTjuJVqlfRx3Ommk3nULHY3sWAp9LaT-xBmIVyAaOstQBmUF7FuVkFx1pJT1_eMzIgpYnGsPRK6DtP4kvR1YJmm7mxjIdDVRRuR5BzCIlquPJtZORyxpQg')" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
          </div>
          <div className="relative z-10 max-w-[1440px] mx-auto w-full px-6 md:px-margin-desktop flex items-end gap-gutter">
            {/* Institution Logo */}
            <div className="w-32 h-32 md:w-40 md:h-40 bg-white p-2 rounded shadow-industrial-md border border-outline-variant flex-shrink-0 flex items-center justify-center overflow-hidden">
                <span className="text-4xl text-primary font-bold uppercase">{school.name.substring(0, 2)}</span>
            </div>
            
            <div className="text-white pb-2 flex-grow">
              <h1 className="font-display-lg text-headline-lg-mobile md:text-display-lg mb-2">{school.name}</h1>
              <p className="font-body-lg text-body-md md:text-body-lg opacity-90 max-w-2xl mb-4">
                {school.description || "Empowering the next generation of leaders through rigorous academic training, expert mentorship, and comprehensive examination preparation."}
              </p>
              <div className="flex items-center gap-2 bg-surface/10 backdrop-blur-md px-4 py-2 rounded-full w-fit border border-white/20">
                <span className="material-symbols-outlined text-secondary-fixed icon-fill text-sm">groups</span>
                <span className="font-label-md text-label-md text-white">Active learning community</span>
              </div>
            </div>
          </div>
        </section>

        {/* Layout Wrapper for Content & Sidebar */}
        <div className="max-w-[1440px] mx-auto w-full px-6 md:px-margin-desktop py-stack-lg flex flex-col lg:flex-row gap-gutter">
          
          {/* Left Sidebar: Contact & Social */}
          <aside className="w-full lg:w-[280px] flex-shrink-0 flex flex-col gap-6">
            {/* Contact Card */}
            <div className="bg-white border border-[#C2B59B] rounded shadow-industrial-sm p-6">
              <h3 className="font-headline-sm text-headline-sm text-primary mb-4 border-b border-[#C2B59B] pb-2">Connect</h3>
              <ul className="flex flex-col gap-4 font-body-sm text-body-sm text-on-surface-variant">
                {school.website_url && (
                    <li className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-xl">language</span>
                        <a className="hover:text-secondary transition-colors" href={school.website_url}>{school.website_url.replace(/^https?:\/\//, '')}</a>
                    </li>
                )}
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-xl">mail</span>
                  <a className="hover:text-secondary transition-colors" href={`mailto:admissions@${resolvedParams.school}.edu.ng`}>admissions@{resolvedParams.school}.edu.ng</a>
                </li>
                {school.whatsapp_number && (
                    <li className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-xl">call</span>
                        <span>{school.whatsapp_number}</span>
                    </li>
                )}
              </ul>
              <div className="mt-6 pt-4 border-t border-[#C2B59B] flex gap-4">
                <a className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-colors" href="#">
                  <span className="material-symbols-outlined">share</span>
                </a>
                {school.whatsapp_number && (
                    <a className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-colors" href={`https://wa.me/${school.whatsapp_number}`}>
                    <span className="material-symbols-outlined">chat</span>
                    </a>
                )}
              </div>
            </div>

            {/* Video Intro Placeholder */}
            <div className="bg-white border border-[#C2B59B] rounded shadow-industrial-sm overflow-hidden group cursor-pointer relative">
              <div className="h-48 w-full bg-surface-container-highest relative bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAqp4d5MXnULEohtzhbgOsw0v-TVkNO3O_XkLAwVIR7FXhfJo4LizIm-WMLAh6Iw-wPTs1TyZC5wQir7T_t0-naBWfDMt1gcm7pt_gPli4OZB8uYdTkwaHkom2hyeurromLea5uTi1t2zSUG6tCVKkP8FM2j8eFc9HdeoedCD_t1mue-dQO9MRfmefcnIPg12VS9Q_JAqhxas68g2q1vhKoM0LjZHWyGdupaakVs1iiz1wskwBAhjiXQfY_bbvoMXbQPk3NCx-74is')" }}>
                <div className="absolute inset-0 bg-primary/20 group-hover:bg-primary/40 transition-colors flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-secondary text-4xl icon-fill">play_arrow</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white">
                <h4 className="font-headline-sm text-headline-sm text-primary text-base">Campus Tour & Intro</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">2 mins watch</p>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-stack-lg">
            
            {/* Promotional Banners Section (Bento style) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="relative h-48 md:h-64 rounded overflow-hidden group cursor-pointer border border-[#C2B59B]">
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105 bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAzW3ImkcKaLJyR57pR-7CibAWhdOKQ_0a3cYZDbgTk4b9STnbszZllbtRYMwRba0iQdj9tIEO3g7zMIU9DQlrmlCFM0FWOfMpRhoupOwAbztgLwUVS7c7Emi3Jt4OAMzTMf0yzeH-LbsLJ-4udKSolWOrQ7WORJP4KZDUm8yTjN51rhTemBJnrRYM7yyhG-nZJmaqu1ncM9fu2xNXr4yXsJMNgEq2ajfsUjvFYIYf0fN1tG7ORzgTiP6j9myUfv5uafb8VU8KLr0M')" }}></div>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/40"></div>
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <span className="bg-secondary text-white font-label-md text-label-md px-2 py-1 rounded w-fit mb-2 uppercase tracking-wider">Featured</span>
                  <h3 className="font-headline-lg text-headline-lg-mobile md:text-headline-sm text-white font-bold leading-tight">Masterclass Series</h3>
                  <p className="font-body-sm text-body-sm text-white/80 mt-2">Intensive preparation courses designed for excellence.</p>
                </div>
              </div>
              <div className="relative h-48 md:h-64 rounded overflow-hidden group cursor-pointer border border-[#C2B59B]">
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105 bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB44Odx4hkiIhK5ebyK5apq_MsN1YSgrK_oOwQ_2PM3MwzfCXM5swhzDZODOhUhKL8sz4WezH-C2KjUOAgywWz3zzgNZX1S2q5TBf9bzmU4q8Ix6Gh__-JWOvW5AXYvrLfXgbihvL0fPt1JWcnuflmyWqXANAzowJXA8aUnUbdggWpZWhMtu9BWrxA01PCK8SYJtysrx1Vq8AMrlEg7TS6sNou8jIn0OsQdbJaNszSdc7NVQJkeVx8xwjeFHvV3lAKsLwE7OSfwWg4')" }}></div>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/40"></div>
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <span className="bg-secondary text-white font-label-md text-label-md px-2 py-1 rounded w-fit mb-2 uppercase tracking-wider">Combo Deals</span>
                  <h3 className="font-headline-lg text-headline-lg-mobile md:text-headline-sm text-white font-bold leading-tight">Exam Prep Combo</h3>
                  <p className="font-body-sm text-body-sm text-white/80 mt-2">Comprehensive coverage of core sciences and arts.</p>
                </div>
              </div>
            </section>

            {/* Product Catalog (Programmes) */}
            <section>
              <div className="flex justify-between items-end mb-6 border-b border-[#C2B59B] pb-2">
                <h2 className="font-headline-md text-headline-md text-primary">Our Programmes</h2>
                <button className="font-label-md text-label-md text-secondary hover:text-primary transition-colors flex items-center gap-1">
                    View All <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>

              {programmes.length === 0 && standalone_courses.length === 0 && (
                <div className="text-center p-12 border border-outline-variant rounded bg-surface-container-low">
                    <p className="text-on-surface-variant font-medium">No published programmes available right now.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
                {programmes.map((prog: any) => (
                    <Link key={prog.id} href={`/${school.slug}/${prog.slug}`} className="bg-white border border-[#C2B59B] rounded shadow-industrial-sm flex flex-col group hover:shadow-industrial-md transition-shadow">
                        <div className="h-40 w-full relative overflow-hidden bg-surface-container-high border-b border-[#C2B59B] bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDQO-17lfmzS1zK5WWuuv4AxhQskhptfU6zjXbOUu8PEEyyJpdcp9H4O5KaP02h_IfKtW9ssQtHG6LazeDjBt-3fTfEgm695LHD_VjSUas7uYzicew6RHMrCqSReaKLwp6jLsocaBTZ83w3rrNKINsaaJ27AyK45mwJbKORY9oFwuEnhzQ0-r91qpnt7uVc0HMEXoeNQAu0rlJS-mAXR5utJuAKppn97t1FyECEHVwBrauQ82X1DR2wchYj-htPiHEU3HBI2fPSBKk')" }}>
                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded border border-[#C2B59B] flex items-center gap-1">
                                <span className="material-symbols-outlined text-secondary text-sm icon-fill">star</span>
                                <span className="font-label-md text-label-md text-primary">5.0/5.0</span>
                            </div>
                        </div>
                        <div className="p-4 flex flex-col flex-grow">
                            <div className="text-[10px] text-white bg-secondary px-2 py-1 rounded w-fit mb-2 font-bold tracking-wider">PROGRAMME</div>
                            <h4 className="font-headline-sm text-headline-sm text-primary mb-1 line-clamp-1">{prog.name}</h4>
                            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mb-4">{prog.description}</p>
                            <div className="mt-auto flex items-center justify-between border-t border-[#C2B59B] pt-4">
                                <div className="font-headline-sm text-headline-sm text-secondary font-bold">₦{prog.price.toLocaleString()}</div>
                                <div className="flex items-center gap-1 text-on-surface-variant font-label-md text-label-md">
                                    <span className="material-symbols-outlined text-[16px]">group</span> Active
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}

                {standalone_courses.map((course: any) => (
                    <Link key={course.id} href={`/${school.slug}/course/${course.slug}`} className="bg-white border border-[#C2B59B] rounded shadow-industrial-sm flex flex-col group hover:shadow-industrial-md transition-shadow">
                        <div className="h-40 w-full relative overflow-hidden bg-surface-container-high border-b border-[#C2B59B] bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAykB7jIBayr9lKxIgEKA5ogbdY7ETcqcvutz8j03NHVJ5vFPGvrhaTUuNv3DkEvkqrdFFwQAzKy5uqhOwQiKmPzewXNblaqlea2QlPZUC5sf-ALESxKqpJeobtHUodzE7yvKhcOONzNklqhleVZz8qlxElMocYXzLUBsm05s9outjtRN-2YAGNLBSMNFdhLVNKI1OChtiImwAYm-IZ6zdk3lp55kZV9qRF2HXQGwoypj8o2gnZ5hDxcCawD4wNp-HssJeD749eXew')" }}>
                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded border border-[#C2B59B] flex items-center gap-1">
                                <span className="material-symbols-outlined text-secondary text-sm icon-fill">star</span>
                                <span className="font-label-md text-label-md text-primary">5.0/5.0</span>
                            </div>
                        </div>
                        <div className="p-4 flex flex-col flex-grow">
                            <div className="text-[10px] text-white bg-primary px-2 py-1 rounded w-fit mb-2 font-bold tracking-wider">STANDALONE</div>
                            <h4 className="font-headline-sm text-headline-sm text-primary mb-1 line-clamp-1">{course.name}</h4>
                            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mb-4">{course.description}</p>
                            <div className="mt-auto flex items-center justify-between border-t border-[#C2B59B] pt-4">
                                <div className="font-headline-sm text-headline-sm text-secondary font-bold">₦{course.price.toLocaleString()}</div>
                                <div className="flex items-center gap-1 text-on-surface-variant font-label-md text-label-md">
                                    <span className="material-symbols-outlined text-[16px]">play_lesson</span> Course
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
              </div>
            </section>

            {/* Tutor Roster */}
            {tutors && tutors.length > 0 && (
                <section className="bg-surface-container-low p-6 md:p-8 rounded border border-[#C2B59B]">
                <div className="flex justify-between items-end mb-6 border-b border-[#C2B59B] pb-2">
                    <h2 className="font-headline-md text-headline-md text-primary">Meet Our Tutors</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {tutors.map((tutor: any) => (
                        <div key={tutor.id} className="flex flex-col items-center text-center">
                            <div className="w-24 h-24 rounded-full border-2 border-primary mb-3 bg-white p-1 overflow-hidden">
                                <div className="w-full h-full rounded-full bg-surface-variant flex items-center justify-center">
                                    <span className="text-3xl font-bold text-primary">{tutor.first_name[0]}{tutor.last_name[0]}</span>
                                </div>
                            </div>
                            <h4 className="font-headline-sm text-headline-sm text-primary text-base">{tutor.first_name} {tutor.last_name}</h4>
                            <p className="font-label-md text-label-md text-secondary mt-1 uppercase tracking-widest line-clamp-1">{tutor.bio || "Instructor"}</p>
                        </div>
                    ))}
                </div>
                </section>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-stack-lg px-6 md:px-margin-desktop flex flex-col md:flex-row justify-between items-start gap-gutter bg-primary text-on-primary font-body-sm text-body-sm mt-stack-lg border-t-4 border-secondary">
        <div className="flex flex-col gap-4">
          <div className="font-headline-sm text-headline-sm font-black text-on-primary">Kanvise</div>
          <p className="text-primary-fixed-dim/80">© {new Date().getFullYear()} Kanvise. Empowering the next generation of African educators.</p>
        </div>
        <nav className="flex flex-wrap gap-6">
          <a className="text-primary-fixed-dim/80 hover:text-secondary-fixed transition-colors opacity-90 hover:opacity-100" href="#">About Us</a>
          <a className="text-primary-fixed-dim/80 hover:text-secondary-fixed transition-colors opacity-90 hover:opacity-100" href="#">Privacy Policy</a>
          <a className="text-primary-fixed-dim/80 hover:text-secondary-fixed transition-colors opacity-90 hover:opacity-100" href="#">Terms of Service</a>
          <a className="text-primary-fixed-dim/80 hover:text-secondary-fixed transition-colors opacity-90 hover:opacity-100" href="#">Contact Support</a>
        </nav>
      </footer>
    </div>
  );
}
