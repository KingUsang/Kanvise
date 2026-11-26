import { NextResponse } from 'next/server'
import { deploymentIdentity } from '@/lib/deployment-identity'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ...deploymentIdentity(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
