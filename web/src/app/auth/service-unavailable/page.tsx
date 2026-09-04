import Link from 'next/link'

export default function AuthServiceUnavailablePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf9f8] px-6 py-12">
      <section className="w-full max-w-md rounded-xl border border-[#c8c5d2] bg-white p-8 text-center shadow-[0_8px_30px_rgba(61,61,61,0.08)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1e7] text-[#994704]">
          <span className="material-symbols-outlined">cloud_off</span>
        </div>
        <h1 className="mt-5 text-2xl font-bold text-[#1b1c1c]">We could not verify your session</h1>
        <p className="mt-3 text-sm leading-6 text-[#474551]">
          The sign-in service is temporarily unreachable. Your work is safe; wait a moment and try the dashboard again.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#994704] px-5 text-sm font-semibold text-white hover:bg-[#7a3903]"
        >
          Try again
        </Link>
      </section>
    </main>
  )
}
