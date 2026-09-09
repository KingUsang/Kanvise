export default function MockLinkLoading() {
  return <main aria-busy="true" aria-label="Loading mock" className="mx-auto max-w-5xl animate-pulse px-4 py-10 sm:px-6 lg:py-14">
    <section className="overflow-hidden rounded-3xl border border-[#e3ded9] bg-white"><div className="h-48 bg-[#ddd8e8]" /><div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_300px]"><div><div className="h-6 w-48 rounded bg-[#ddd8d4]" /><div className="mt-4 h-4 max-w-xl rounded bg-[#ece8e4]" /><div className="mt-2 h-4 max-w-md rounded bg-[#ece8e4]" /></div><div className="h-64 rounded-2xl bg-[#f0ece8]" /></div></section>
    <span className="sr-only">Loading…</span>
  </main>
}
