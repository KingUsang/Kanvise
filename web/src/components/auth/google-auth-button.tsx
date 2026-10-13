import type { MouseEventHandler } from 'react'

export function GoogleAuthButton({ href, label = 'Continue with Google', onClick }: { href: string; label?: string; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return <a href={href} onClick={onClick} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#c8c5d2] bg-white px-4 font-semibold text-[#2e2877] transition hover:border-[#2e2877] hover:bg-[#f7f5ff] focus:outline-none focus:ring-2 focus:ring-[#2e2877] focus:ring-offset-2"><span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full border border-[#dadce0] font-bold text-[#4285f4]">G</span>{label}</a>
}

export function AuthMethodDivider() {
  return <div className="my-5 flex items-center gap-3" aria-hidden><span className="h-px flex-1 bg-[#e4e2e1]"/><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#787582]">or use email</span><span className="h-px flex-1 bg-[#e4e2e1]"/></div>
}
