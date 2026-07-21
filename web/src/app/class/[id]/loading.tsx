export default function ClassroomLoading() {
  return (
    <main className="flex h-screen flex-col bg-[#f5f3f2]" aria-busy="true" aria-label="Preparing classroom">
      <header className="flex h-16 items-center gap-3 border-b border-[#e4e2e1] bg-white px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#180d62] font-bold text-white">K</div>
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-[#d8d3e4]" />
          <div className="h-2.5 w-28 animate-pulse rounded bg-[#eeeaf2]" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center p-5">
        <div className="flex w-full max-w-sm flex-col items-center rounded-2xl bg-white p-8 text-center shadow-[0_12px_36px_rgba(24,13,98,0.08)]">
          <div className="mb-5 h-12 w-12 animate-spin rounded-full border-4 border-[#e4e2e1] border-t-[#180d62]" />
          <h1 className="text-lg font-bold text-[#180d62]">Preparing your classroom</h1>
          <p className="mt-2 text-sm leading-6 text-[#787582]">Checking your session and connecting to the live class…</p>
        </div>
      </div>
    </main>
  )
}
