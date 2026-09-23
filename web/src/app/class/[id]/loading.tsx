export default function ClassroomLoading() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans" aria-busy="true" aria-label="Preparing classroom">
      <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eeeaff]">
          <span className="material-symbols-outlined animate-spin text-[#2e2877]" aria-hidden="true">progress_activity</span>
        </span>
        <h1 className="mt-5 text-xl font-bold text-[#180d62]">Preparing classroom</h1>
        <p className="mt-2 text-sm leading-6 text-[#66616c]">Connecting you to the live class. This may take a moment on a cold start.</p>
      </section>
    </main>
  )
}
