export function AuthLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-white shadow-[0px_4px_20px_rgba(61,61,61,0.08)] ring-1 ring-kv-dust/40">
        <img src="/kanvise_logo.jpeg" alt="Kanvise" className="h-full w-full object-cover" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-kv-blue">Kanvise</h1>
    </div>
  )
}
