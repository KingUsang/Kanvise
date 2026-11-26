'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { toast } from 'sonner'

type AntiCheatWrapperProps = {
  children: ReactNode
  onAutoSubmit: () => void
}

// Time away is measured with Date.now() from the moment the page was hidden, so a
// throttled background timer cannot under-count it. The auto-submit callback is
// held in a ref so a parent re-render never resets the away clock (DEV-QUIZ-030).
export const AWAY_LIMIT_MS = 120_000

export function AntiCheatWrapper({ children, onAutoSubmit }: AntiCheatWrapperProps) {
  const submitRef = useRef(onAutoSubmit)
  useEffect(() => { submitRef.current = onAutoSubmit })

  useEffect(() => {
    let hiddenAt: number | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    function leave() {
      if (hiddenAt === null) return
      hiddenAt = null
      if (timer) clearTimeout(timer)
      toast.error("Quiz automatically submitted due to leaving the exam window for 2 minutes.")
      submitRef.current()
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (hiddenAt !== null) return
        hiddenAt = Date.now()
        timer = setTimeout(() => {
          if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_LIMIT_MS - 50) leave()
        }, AWAY_LIMIT_MS)
      } else if (hiddenAt !== null) {
        const away = Date.now() - hiddenAt
        if (timer) clearTimeout(timer)
        if (away >= AWAY_LIMIT_MS) leave()
        else hiddenAt = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <div
      className="select-none"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
}
