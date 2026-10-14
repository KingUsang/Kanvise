import type { MouseEventHandler } from 'react'

export function GoogleAuthButton({ href, label = 'Continue with Google', onClick }: { href: string; label?: string; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return <a href={href} onClick={onClick} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#d7d5df] bg-white px-4 text-sm font-medium text-[#2e2877] transition hover:border-[#aaa6bd] hover:bg-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#2e2877] focus:ring-offset-2">
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z"/>
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.35l-3.24-2.55c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.63A10 10 0 0 0 12 22Z"/>
      <path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.09 12c0-.67.11-1.32.31-1.93V7.44H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.56l3.35-2.63Z"/>
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.44l3.35 2.63c.79-2.37 3-4.13 5.6-4.13Z"/>
    </svg>
    {label}
  </a>
}

export function AuthMethodDivider() {
  return <div className="my-5 flex items-center gap-3" aria-hidden><span className="h-px flex-1 bg-[#e4e2e1]"/><span className="text-xs text-[#787582]">or continue with email</span><span className="h-px flex-1 bg-[#e4e2e1]"/></div>
}
