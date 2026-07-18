import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CheckoutButton } from "../../../components/public/checkout-button";

async function getProgramme(slug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/public/programmes/${slug}`, {
    next: { revalidate: 60 }
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch programme");
  }
  const json = await res.json();
  return json.data;
}

export default async function ProgrammeMarketingPage({ params }: { params: Promise<{ school: string, programmeSlug: string }> }) {
  const resolvedParams = await params;
  const data = await getProgramme(resolvedParams.programmeSlug);
  
  if (!data) {
    notFound();
  }

  const { programme, school, sub_programmes, courses, tutor } = data;

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen overflow-x-hidden scroll-smooth">
      <style dangerouslySetInnerHTML={{ __html: `
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid #C2B59B;
        }
        .industrial-shadow {
            box-shadow: 0px 4px 20px rgba(61, 61, 61, 0.08);
        }
        .gradient-overlay {
            background: linear-gradient(135deg, rgba(46, 40, 119, 0.95) 0%, rgba(24, 13, 98, 0.8) 100%);
        }
      ` }} />
      {/* Top AppBar */}
      <header className="bg-surface sticky top-0 z-50 border-b border-outline-variant shadow-sm flex justify-between items-center h-20 px-6 md:px-margin-desktop">
        <div className="flex items-center gap-3">
          <Link href={`/${resolvedParams.school}`} className="flex items-center gap-2 hover:opacity-80 transition">
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
            <span className="font-headline-md text-headline-md font-bold text-primary">Kanvise</span>
          </Link>
          <div className="h-6 w-px bg-outline-variant hidden md:block"></div>
          <span className="font-label-md text-label-md text-on-surface-variant tracking-widest uppercase hidden md:block">LMS | Elite Portal</span>
        </div>
        <div className="flex items-center gap-6">
          <nav className="hidden lg:flex gap-8 items-center">
            {sub_programmes && sub_programmes.length > 0 && <a className="text-on-surface-variant font-medium hover:text-primary transition-colors" href="#curriculum">Curriculum</a>}
            {tutor && <a className="text-on-surface-variant font-medium hover:text-primary transition-colors" href="#tutor">The Tutor</a>}
            <a className="text-on-surface-variant font-medium hover:text-primary transition-colors" href="#enroll">Pricing</a>
          </nav>
          <a className="bg-secondary text-on-primary px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-all transform active:scale-95 shadow-lg" href="#enroll">
            Enroll Now
          </a>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[870px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBxys5-q6_1t8HT9xc9H-GnjRemBs0AbjyL4Jlr5RCmAU5kcTrkX_5le642_oIo_BTn2KUXK_5AbJDkknXroOwyZZar48RM5u5fac8yPGAy0gIVaycBSLoIfQr3Fa9HKbXXZanpWCgJHlLwczk51TJZwDEZGHJkVrG3GLg1lhvloDXmOB5FO29ikjlksq-6lY93m34jz4T-ejK3g3uhx2_0yNRwaxvDtNugK3OGj9R8_A27n46PivOqa9z-KErEGBmGFaOFt8TAPWw')" }}></div>
            <div className="absolute inset-0 gradient-overlay"></div>
          </div>
          <div className="container mx-auto px-6 md:px-margin-desktop relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 py-20">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-8">
              <div className="inline-flex items-center gap-2 bg-secondary/20 border border-secondary/30 px-4 py-2 rounded-full w-fit">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                <span className="text-secondary font-bold text-label-md tracking-wider uppercase">ELITE PROGRAMME</span>
              </div>
              <h1 className="font-display-lg text-display-lg text-white leading-tight">
                {programme.name}
              </h1>
              <p className="font-body-lg text-body-lg text-primary-fixed max-w-xl">
                {programme.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <a className="bg-secondary text-on-primary px-10 py-4 rounded-xl font-headline-sm text-headline-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl group" href="#enroll">
                  Secure Your Seat
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </a>
                <div className="flex items-center gap-3 px-6 py-4">
                  <span className="material-symbols-outlined text-secondary">verified_user</span>
                  <span className="text-primary-fixed text-body-md">100% Satisfaction Guarantee</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-5 flex items-center justify-center">
              <div className="glass-card p-8 rounded-2xl w-full max-w-md industrial-shadow relative">
                <div className="absolute -top-6 -right-6 bg-secondary text-white p-4 rounded-full font-bold shadow-lg transform rotate-12">
                  HOT
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-on-surface-variant font-label-md uppercase tracking-widest">Enrolment Fee</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-primary font-display-lg text-4xl">₦{programme.price.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-px bg-outline-variant"></div>
                  <ul className="space-y-4">
                    <li className="flex gap-3">
                      <span className="material-symbols-outlined text-secondary">check_circle</span>
                      <span className="text-on-surface">Full access to all modules</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="material-symbols-outlined text-secondary">check_circle</span>
                      <span className="text-on-surface">Join Live Classes with instructors</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="material-symbols-outlined text-secondary">check_circle</span>
                      <span className="text-on-surface">Weekly CBT Mock Exams</span>
                    </li>
                  </ul>
                  <a className="w-full bg-primary-container text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-all" href="#enroll">
                    Get Started Now
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Curriculum Preview Section */}
        {((sub_programmes && sub_programmes.length > 0) || (courses && courses.length > 0)) && (
          <section className="py-24 bg-surface" id="curriculum">
            <div className="container mx-auto px-6 md:px-margin-desktop">
              <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                <span className="text-secondary font-bold tracking-widest uppercase text-sm">Curriculum</span>
                <h2 className="font-headline-lg text-headline-lg text-primary">What You'll Learn</h2>
                <p className="text-on-surface-variant text-body-lg">A structured path to complete mastery.</p>
              </div>
              
              <div className="max-w-4xl mx-auto space-y-8">
                {sub_programmes && sub_programmes.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-headline-md text-primary mb-6 border-b border-outline-variant pb-2">Modules & Sections</h3>
                    {sub_programmes.map((sub: any) => (
                      <div key={sub.id} className="p-6 border border-outline-variant rounded-2xl bg-white hover:border-secondary transition-colors group">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-headline-sm text-primary mb-2">{sub.name}</h4>
                            <p className="text-on-surface-variant">{sub.description}</p>
                          </div>
                          {sub.price > 0 && (
                            <div className="bg-surface-container-low px-4 py-2 rounded-lg border border-outline-variant hidden sm:block">
                              <span className="font-bold text-primary">₦{sub.price.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {courses && courses.length > 0 && (
                  <div className="space-y-4 mt-12">
                    <h3 className="font-headline-md text-primary mb-6 border-b border-outline-variant pb-2">Included Courses</h3>
                    {courses.map((course: any) => (
                      <div key={course.id} className="p-6 border border-outline-variant rounded-2xl bg-white hover:border-secondary transition-colors group flex gap-4 items-center">
                        <div className="w-12 h-12 bg-primary-container/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary">play_lesson</span>
                        </div>
                        <div>
                          <h4 className="font-headline-sm text-primary mb-1">{course.name}</h4>
                          <p className="text-on-surface-variant text-sm line-clamp-2">{course.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Tutor Bio Section */}
        {tutor && (
          <section className="py-24 bg-surface-container-low" id="tutor">
            <div className="container mx-auto px-6 md:px-margin-desktop">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="relative">
                  <div className="aspect-square rounded-3xl overflow-hidden industrial-shadow bg-primary flex items-center justify-center">
                    <span className="text-9xl text-white font-bold uppercase">{tutor.first_name[0]}{tutor.last_name[0]}</span>
                  </div>
                  <div className="absolute -bottom-8 -right-8 bg-white p-6 rounded-2xl shadow-xl border border-outline-variant hidden md:block">
                    <div className="flex items-center gap-4">
                      <div className="bg-secondary text-white p-3 rounded-xl">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
                      </div>
                      <div>
                        <p className="font-bold text-primary">Instructor</p>
                        <p className="text-xs text-on-surface-variant">Programme Lead</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <span className="text-secondary font-bold tracking-widest uppercase">MEET YOUR INSTRUCTOR</span>
                  <h2 className="font-headline-lg text-headline-lg text-primary">{tutor.first_name} {tutor.last_name}</h2>
                  <p className="text-body-lg text-on-surface-variant leading-relaxed">
                    {tutor.bio || "An expert instructor committed to helping you excel in your studies."}
                  </p>
                  <div className="flex gap-4 pt-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-outline-variant rounded-lg">
                      <span className="material-symbols-outlined text-secondary">verified</span>
                      <span className="text-sm font-medium">Certified Elite Tutor</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Enrollment Form & CTA */}
        <section className="py-24 bg-primary-container relative overflow-hidden" id="enroll">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="grid grid-cols-12 h-full">
              <div className="border-r border-white/20 h-full"></div>
              <div className="border-r border-white/20 h-full"></div>
              <div className="border-r border-white/20 h-full"></div>
              <div className="border-r border-white/20 h-full"></div>
              <div className="border-r border-white/20 h-full"></div>
              <div className="border-r border-white/20 h-full"></div>
            </div>
          </div>
          <div className="container mx-auto px-6 md:px-margin-desktop relative z-10">
            <div className="max-w-5xl mx-auto glass-card overflow-hidden rounded-3xl grid grid-cols-1 lg:grid-cols-2 shadow-2xl">
              <div className="bg-primary-container p-12 text-white flex flex-col justify-between">
                <div className="space-y-6">
                  <h2 className="font-headline-lg text-headline-lg">Join the Elite Class</h2>
                  <p className="text-primary-fixed/80 text-body-md">Register today to secure your spot. Immediate access granted upon confirmation.</p>
                  <div className="space-y-6 pt-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-white/10 p-2 rounded-lg">
                        <span className="material-symbols-outlined text-secondary-fixed-dim">mail_outline</span>
                      </div>
                      <div>
                        <p className="font-bold">Instant Access</p>
                        <p className="text-sm text-primary-fixed/60">You will be granted immediate access to the programme after payment.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="bg-white/10 p-2 rounded-lg">
                        <span className="material-symbols-outlined text-secondary-fixed-dim">lock</span>
                      </div>
                      <div>
                        <p className="font-bold">Secure Payment</p>
                        <p className="text-sm text-primary-fixed/60">Encrypted transaction processing via trusted payment gateways.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-12 flex items-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all cursor-default">
                  <span className="material-symbols-outlined text-4xl">shield_locked</span>
                  <span className="material-symbols-outlined text-4xl">security</span>
                  <span className="material-symbols-outlined text-4xl">verified_user</span>
                </div>
              </div>
              <div className="p-12 bg-white flex flex-col justify-center">
                <div className="space-y-6">
                  <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-on-surface-variant font-medium">Programme Fee:</span>
                      <span className="text-on-surface font-bold text-sm">Base Price</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-primary font-bold">Total to Pay:</span>
                      <span className="text-secondary font-extrabold text-2xl">₦{programme.price.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {/* Using the CheckoutButton exactly as requested, no custom form fields */}
                  <CheckoutButton 
                    schoolSlug={resolvedParams.school} 
                    programmeId={programme.id} 
                    price={programme.price} 
                    programmeSlug={resolvedParams.programmeSlug}
                  />
                  
                  <p className="text-center text-xs text-on-surface-variant italic mt-4">
                    By clicking, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-primary-container py-16 text-white">
        <div className="container mx-auto px-6 md:px-margin-desktop">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2 space-y-6">
              <span className="font-headline-md text-headline-md font-bold">Kanvise</span>
              <p className="text-primary-fixed/80 max-w-sm text-body-md">
                Elite tutoring platform designed for the modern student. Authority, precision, and high-energy productivity.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-bold text-white tracking-widest uppercase text-sm">Quick Links</h4>
              <ul className="space-y-3 text-primary-fixed/80">
                <li><a className="hover:text-secondary transition-colors" href={`/${resolvedParams.school}`}>All Programmes</a></li>
                <li><Link className="hover:text-secondary transition-colors" href="/auth/login">Student Login</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-white/20 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-primary-fixed/60">
            <p>© {new Date().getFullYear()} Kanvise. All rights reserved.</p>
            <div className="flex gap-6">
              <a className="hover:text-white transition-colors" href="#">Privacy Policy</a>
              <a className="hover:text-white transition-colors" href="#">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
