'use client'

import { RouteError } from '@/components/common/route-error'

export default function StudentPortalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />
}
