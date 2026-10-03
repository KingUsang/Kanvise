'use client'

import { useEffect, useState } from 'react'

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardGreeting({ name }: { name?: string | null }) {
  const [greeting, setGreeting] = useState('Welcome back')
  useEffect(() => {
    const update = () => setGreeting(greetingFor(new Date().getHours()))
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return <>{greeting}{name ? `, ${name}` : ''} <span role="img" aria-label="waving hand">👋</span></>
}
