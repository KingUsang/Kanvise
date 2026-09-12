type MockBuilderStep = {
  id: string
  label: string
}

type MockBuilderStepProgressProps = {
  steps: MockBuilderStep[]
  currentStepId: string
  visitedStepIds: ReadonlySet<string>
  disabled?: boolean
  onStepSelect: (stepId: string) => void
}

export function MockBuilderStepProgress({
  steps,
  currentStepId,
  visitedStepIds,
  disabled = false,
  onStepSelect,
}: MockBuilderStepProgressProps) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === currentStepId))
  const currentStep = steps[currentIndex]
  const progress = steps.length > 0 ? ((currentIndex + 1) / steps.length) * 100 : 0

  return (
    <nav
      aria-label="Mock builder steps"
      className="sticky top-16 z-20 -mx-4 mb-6 border-y border-[#e4e2e1] bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:mb-8 sm:rounded-xl sm:border sm:px-3"
    >
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-[#1b1c1c]">{currentStep?.label}</p>
          <p className="shrink-0 text-xs font-medium text-[#716c76]">
            Step {currentIndex + 1} of {steps.length}
          </p>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4e2f2]"
          role="progressbar"
          aria-label="Mock creation progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={currentIndex + 1}
        >
          <div className="h-full rounded-full bg-[#2e2877] transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="hidden gap-2 sm:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStepId
          const canOpen = isCurrent || visitedStepIds.has(step.id)
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepSelect(step.id)}
              disabled={disabled || !canOpen}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${index + 1}. ${step.label}`}
              title={!canOpen ? "Continue through the earlier steps first" : undefined}
              className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${isCurrent ? "bg-[#2e2877] text-white" : "text-[#5f5964] hover:bg-[#f5f3f8]"}`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px]">{index + 1}</span>
              <span className="truncate">{step.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
