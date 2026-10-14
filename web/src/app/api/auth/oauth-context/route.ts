import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiUrl } from '@/config/api'
import { OAUTH_CONTEXT_COOKIE, readOAuthContext } from '@/lib/auth/oauth-context'

export async function GET() {
  const context = readOAuthContext((await cookies()).get(OAUTH_CONTEXT_COOKIE)?.value)
  if (!context) return NextResponse.json({ error: 'Your sign-in session has expired. Start again.' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Your Google session could not be opened.' }, { status: 401 })
  let invitation: Record<string, unknown> | null = null
  if (context.intent === 'invitation' && context.invitationToken) {
    const response = await fetch(`${getApiUrl()}/auth/invitation/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: context.invitationToken }), cache: 'no-store' })
    const body = await response.json().catch(() => null)
    if (!response.ok) return NextResponse.json({ error: body?.error || 'This invitation is unavailable.' }, { status: response.status })
    invitation = body.data
  }
  const fullName = String(user.user_metadata?.full_name || '').trim().split(/\s+/)
  return NextResponse.json({ data: {
    intent: context.intent, account_type: context.accountType, email: user.email,
    first_name: user.user_metadata?.first_name || fullName[0] || '',
    last_name: user.user_metadata?.last_name || fullName.slice(1).join(' ') || '',
    invitation_token: context.intent === 'invitation' ? context.invitationToken : undefined,
    invitation,
  } })
}
