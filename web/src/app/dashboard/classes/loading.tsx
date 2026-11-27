export default function ClassesLoading() {
  return (
    <div className="mx-auto w-full max-w-[1500px]" role="status" aria-busy="true" aria-label="Loading class">
      <div className="h-5 w-28 animate-pulse rounded bg-[#eae8e7]" />
      <section className="mt-5 rounded-2xl border border-dashboard-outline bg-white p-6 shadow-dashboard-card">
        <div className="h-8 w-64 animate-pulse rounded bg-[#eae8e7]" />
        <div className="mt-4 h-4 max-w-xl animate-pulse rounded bg-[#f1efee]" />
        <div className="mt-8 flex gap-3"><div className="h-9 w-24 animate-pulse rounded-full bg-[#f1efee]" /><div className="h-9 w-28 animate-pulse rounded-full bg-[#f1efee]" /></div>
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-3"><div className="h-56 animate-pulse rounded-2xl bg-[#f1efee] lg:col-span-2" /><div className="h-56 animate-pulse rounded-2xl bg-[#f1efee]" /></div>
    </div>
  )
}
