'use client'

import { useEffect, ReactNode } from 'react'
import { toast } from 'sonner'

type AntiCheatWrapperProps = {
  children: ReactNode
  onAutoSubmit: () => void
}

export function AntiCheatWrapper({ children, onAutoSubmit }: AntiCheatWrapperProps) {
  useEffect(() => {
    let blurTimer: ReturnType<typeof setInterval>
    let secondsAway = 0

    function handleVisibilityChange() {
      if (document.hidden) {
        blurTimer = setInterval(() => {
          secondsAway += 1
          if (secondsAway >= 120) {
            clearInterval(blurTimer)
            toast.error("Mock automatically submitted due to leaving the exam window for 2 minutes.")
            onAutoSubmit()
          }
        }, 1000)
      } else {
        if (blurTimer) clearInterval(blurTimer)
        secondsAway = 0
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (blurTimer) clearInterval(blurTimer)
    }
  }, [onAutoSubmit])

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
