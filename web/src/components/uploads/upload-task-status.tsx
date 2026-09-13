type UploadTaskStatusProps = {
  label: string
  progress: number | null
}

export function UploadTaskStatus({ label, progress }: UploadTaskStatusProps) {
  return (
    <div className="rounded-lg border border-[#d9d3ef] bg-[#faf9ff] px-4 py-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[#1b1c1c]">{label}</span>
        {progress !== null && <span className="shrink-0 tabular-nums text-[#5f5964]">{progress}%</span>}
      </div>
      {progress !== null ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e4e2f2]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-[#2e2877] transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      ) : (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4e2f2]" aria-hidden="true">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#2e2877]" />
        </div>
      )}
    </div>
  )
}
