import Link from 'next/link'

/** Static page for public Quiz URLs that were retired. Quizzes now live inside a Class. */
export function RetiredQuizPage() {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
    <h1 className="text-2xl font-semibold text-[#29262f]">This page has been retired</h1>
    <p className="mt-3 text-sm leading-6 text-[#716c76]">Standalone and public Quiz links no longer work. Quizzes are now taken inside your Class. Sign in and open your Class to find them.</p>
    <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2e2877] px-5 text-sm font-semibold text-white">Go to my dashboard</Link>
  </main>
}
