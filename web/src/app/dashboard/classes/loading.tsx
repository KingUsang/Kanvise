export default function ClassesLoading() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8" aria-busy="true" aria-label="Loading class">
      <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 max-w-xl animate-pulse rounded bg-slate-100" />
        <div className="mt-8 flex gap-3"><div className="h-9 w-24 animate-pulse rounded-full bg-slate-100" /><div className="h-9 w-28 animate-pulse rounded-full bg-slate-100" /></div>
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-3"><div className="h-56 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" /><div className="h-56 animate-pulse rounded-2xl bg-slate-100" /></div>
    </main>
  )
}
