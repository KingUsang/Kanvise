import type { Metadata } from 'next'
import { AccountPicker } from '@/components/account/account-picker'
import { safeRedirectPath } from '@/lib/safe-redirect'

export const metadata: Metadata = { title: 'Choose tutoring account | Kanvise' }

export default async function AccountSelectPage({ searchParams }: { searchParams: Promise<{ redirect?: string | string[] }> }) {
  const { redirect } = await searchParams
  const returnPath = safeRedirectPath(Array.isArray(redirect) ? redirect[0] : redirect)
  return <AccountPicker returnPath={returnPath && !returnPath.startsWith('/account/select') ? returnPath : '/dashboard'} />
}
