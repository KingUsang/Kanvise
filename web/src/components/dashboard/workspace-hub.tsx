import Link from 'next/link'
import { DashboardPageHeader } from './page-header'

export type WorkspaceLink = {
  label: string
  description: string
  href: string
  icon: string
}

export function WorkspaceHub({ title, description, sections }: {
  title: string
  description: string
  sections: Array<{ title: string; links: WorkspaceLink[] }>
}) {
  return (
    <section className="mx-auto w-full max-w-[1120px] animate-in fade-in duration-300">
      <DashboardPageHeader title={title} description={description} />
      <div className="mt-7 space-y-7">
        {sections.map(section => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-[#1b1c1c]">{section.title}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {section.links.map(link => (
                <Link key={link.href} href={link.href} className="flex min-h-20 items-center gap-4 rounded-2xl border border-[#e3ded9] bg-white p-5 shadow-[0_1px_2px_rgba(35,31,38,0.04)] transition hover:border-[#c9c1d7] hover:shadow-md">
                  <span className="material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-xl bg-[#eeeafe] text-[#2e2877]">{link.icon}</span>
                  <span><span className="block font-semibold text-[#1b1c1c]">{link.label}</span><span className="mt-0.5 block text-sm text-[#716c76]">{link.description}</span></span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
