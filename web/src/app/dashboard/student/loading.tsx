export default function StudentPortalLoading() {
  return <main aria-busy="true" aria-label="Loading student portal" className="mx-auto max-w-[1440px] animate-pulse px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
    <div className="h-4 w-32 rounded bg-[#e4e0dc]" />
    <div className="mt-3 h-9 w-64 max-w-full rounded bg-[#ddd8d4]" />
    <div className="mt-3 h-4 w-full max-w-xl rounded bg-[#e9e5e1]" />
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map(item => <div key={item} className="h-40 rounded-2xl border border-[#e3ded9] bg-white" />)}
    </div>
    <span className="sr-only">Loading…</span>
  </main>
}
