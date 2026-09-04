import { notFound } from "next/navigation";
import Link from "next/link";

async function getSchool(slug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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

  const { school, programmes, tutors } = data;

  return (
    <div className="font-body-md bg-surface antialiased overflow-x-hidden min-h-screen text-on-surface">
      <style dangerouslySetInnerHTML={{ __html: `
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .icon-fill { font-variation-settings: 'FILL' 1; }
      ` }} />

      {/* TopNavBar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface/95 backdrop-blur-sm flex justify-between items-center px-6 md:px-margin-desktop py-4 border-b border-outline-variant transition-all duration-200 ease-in-out font-body-md text-body-md text-primary h-[72px]">
        <div className="flex items-center gap-8">
          <div className="font-headline-md text-headline-md font-bold text-primary">{school.name}</div>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <Link href="/auth/login" className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors px-4 py-2">
            Login
          </Link>
          <Link href="#programmes" className="bg-secondary text-on-secondary px-6 py-2 rounded font-label-md text-label-md hover:opacity-90 transition-opacity">
            Explore programmes
          </Link>
        </div>
        <a href="#programmes" className="md:hidden text-sm font-semibold text-[#994704]">Programmes</a>
      </header>

      {/* Main Content */}
      <main className="pt-[72px]">
        {/* Hero Section */}
        <section className="relative w-full h-[500px] md:h-[600px] flex flex-col justify-end pb-margin-desktop">
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center" 
            style={{ backgroundImage: school.banner_url ? `url('${school.banner_url}')` : 'linear-gradient(135deg, #2e2877, #180d62)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
          </div>
          <div className="relative z-10 max-w-[1440px] mx-auto w-full px-6 md:px-margin-desktop flex items-end gap-gutter">
            {/* Institution Logo */}
            <div className="w-32 h-32 md:w-40 md:h-40 bg-white p-2 rounded shadow-industrial-md border border-outline-variant flex-shrink-0 flex items-center justify-center overflow-hidden">
                {school.logo_url ? <img src={school.logo_url} alt={`${school.name} logo`} className="h-full w-full object-contain" /> : <span className="text-4xl text-primary font-bold uppercase">{school.name.substring(0, 2)}</span>}
            </div>
            
            <div className="text-white pb-2 flex-grow">
              <h1 className="font-display-lg text-headline-lg-mobile md:text-display-lg mb-2">{school.name}</h1>
              <p className="font-body-lg text-body-md md:text-body-lg opacity-90 max-w-2xl mb-4">
                {school.description || "Explore the programmes currently available from this tutorial centre."}
              </p>
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
                {school.contact_email && <li className="flex items-center gap-3"><span className="material-symbols-outlined text-primary text-xl">mail</span><a className="hover:text-secondary transition-colors" href={`mailto:${school.contact_email}`}>{school.contact_email}</a></li>}
                {school.contact_phone && <li className="flex items-center gap-3"><span className="material-symbols-outlined text-primary text-xl">call</span><a className="hover:text-secondary transition-colors" href={`tel:${school.contact_phone}`}>{school.contact_phone}</a></li>}
                {school.whatsapp_number && (
                    <li className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-xl">call</span>
                        <span>{school.whatsapp_number}</span>
                    </li>
                )}
              </ul>
              <div className="mt-6 pt-4 border-t border-[#C2B59B] flex gap-4">
                {school.instagram_url && <a aria-label="Instagram" className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-colors" href={school.instagram_url} target="_blank" rel="noreferrer"><span className="material-symbols-outlined">photo_camera</span></a>}
                {school.twitter_url && <a aria-label="X" className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-colors" href={school.twitter_url} target="_blank" rel="noreferrer"><span className="text-xs font-bold">X</span></a>}
                {school.facebook_url && <a aria-label="Facebook" className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-colors" href={school.facebook_url} target="_blank" rel="noreferrer"><span className="text-sm font-bold">f</span></a>}
                {school.whatsapp_number && (
                    <a className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-colors" href={`https://wa.me/${school.whatsapp_number}`}>
                    <span className="material-symbols-outlined">chat</span>
                    </a>
                )}
              </div>
            </div>

            {school.video_intro_url && <div className="overflow-hidden rounded border border-[#C2B59B] bg-white shadow-industrial-sm"><video controls preload="metadata" className="aspect-video w-full bg-black" src={school.video_intro_url}>Your browser does not support this video.</video><div className="p-4"><h4 className="font-headline-sm text-base text-primary">Welcome to {school.name}</h4></div></div>}
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-stack-lg">
            
            {/* Product Catalog (Programmes) */}
            <section id="programmes">
              <div className="flex justify-between items-end mb-6 border-b border-[#C2B59B] pb-2">
                <h2 className="font-headline-md text-headline-md text-primary">Our Programmes</h2>
                <span className="font-label-md text-label-md text-on-surface-variant">{programmes.length} available</span>
              </div>

              {programmes.length === 0 && (
                <div className="text-center p-12 border border-outline-variant rounded bg-surface-container-low">
                    <p className="text-on-surface-variant font-medium">No published programmes available right now.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
                {programmes.map((prog: any) => (
                    <Link key={prog.id} href={`/${school.slug}/${prog.slug}`} className="bg-white border border-[#C2B59B] rounded shadow-industrial-sm flex flex-col group hover:shadow-industrial-md transition-shadow">
                        {prog.thumbnail_url ? <img src={prog.thumbnail_url} alt="" className="h-40 w-full border-b border-[#C2B59B] object-cover" /> : <div className="flex h-40 w-full items-end border-b border-[#C2B59B] bg-gradient-to-br from-[#2e2877] to-[#5d569d] p-4 text-white"><span className="font-headline-sm text-xl font-bold">{prog.name}</span></div>}
                        <div className="p-4 flex flex-col flex-grow">
                            <div className="text-[10px] text-white bg-secondary px-2 py-1 rounded w-fit mb-2 font-bold tracking-wider">PROGRAMME</div>
                            <h4 className="font-headline-sm text-headline-sm text-primary mb-1 line-clamp-1">{prog.name}</h4>
                            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mb-4">{prog.description}</p>
                            <div className="mt-auto flex items-center justify-between border-t border-[#C2B59B] pt-4">
                                <div className="font-headline-sm text-headline-sm text-secondary font-bold">{Number(prog.price) === 0 ? 'Free' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: prog.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(prog.price))}</div>
                                <span className="font-label-md text-label-md text-primary">View programme →</span>
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
      <footer className="w-full py-10 px-6 md:px-margin-desktop flex flex-col md:flex-row justify-between items-start gap-gutter bg-primary text-on-primary font-body-sm text-body-sm mt-stack-lg border-t-4 border-secondary">
        <div>
          <div className="font-headline-sm text-headline-sm font-black text-on-primary">{school.name}</div>
          <p className="mt-2 text-primary-fixed-dim/80">Programmes and student learning are powered by Kanvise.</p>
        </div>
        {school.contact_email && <a className="text-primary-fixed-dim/80 hover:text-secondary-fixed" href={`mailto:${school.contact_email}`}>Contact {school.name}</a>}
      </footer>
    </div>
  );
}
