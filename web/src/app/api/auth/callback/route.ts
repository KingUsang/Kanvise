import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OAUTH_CONTEXT_COOKIE, readOAuthContext } from '@/lib/auth/oauth-context'
import { postAuthDestination, type KanviseRole } from '@/lib/auth-continuation'
import { getApiUrl } from '@/config/api'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { ACCOUNT_COOKIE_NAME } from '@/lib/account-cookie'

const PROFILE_INIT_TIMEOUT_MS = 10_000

function redirectOrigin(request: Request) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  return process.env.NODE_ENV === 'development' || !forwardedHost ? url.origin : `${forwardedProto}://${forwardedHost}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = redirectOrigin(request)
  const code = url.searchParams.get('code')
  const accountInvitationToken = url.searchParams.get('account_invitation_token')

  // Preserve the implicit-fragment handoff used by email invitation links.
  if (!code && accountInvitationToken) {
    const handoff = new URL('/auth/invitation/callback', origin)
    handoff.searchParams.set('account_invitation_token', accountInvitationToken)
    const handoffUrl = JSON.stringify(handoff.toString())
    return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><title>Opening invitation</title></head><body><p>Opening your invitation…</p><script>window.location.replace(${handoffUrl} + window.location.hash)</script><noscript><a href="${handoff.toString()}">Continue</a></noscript></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
  if (!code) return NextResponse.redirect(new URL('/auth/auth-code-error?reason=missing_code', origin))

  const supabase = await createClient()
  // The installed supabase-js version stores the matching PKCE verifier in
  // its SSR cookie and accepts only the authorization code here.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) {
    console.error('[auth/callback] code exchange failed', error?.message)
    return NextResponse.redirect(new URL('/auth/auth-code-error?reason=exchange_failed', origin))
  }

  const context = readOAuthContext((await cookies()).get(OAUTH_CONTEXT_COOKIE)?.value)
  if (!context) {
    // Compatibility for existing email confirmation/recovery/invitation links
    // that already target this callback and do not carry our Google context.
    if (accountInvitationToken) return NextResponse.redirect(new URL(`/auth/complete-invitation?token=${encodeURIComponent(accountInvitationToken)}`, origin))
    const role = url.searchParams.get('role')
    // Legacy signed tutor invites were retired (DEV-SEC-008). Tutors join
    // only through durable invitations, so an old tutor link goes to /invite.
    if (role === 'tutor') return NextResponse.redirect(new URL('/invite', origin))
    const next = safeRedirectPath(url.searchParams.get('next'))
    if (!role) return NextResponse.redirect(new URL(next || '/', origin))

    let init: Response | null = null
    try {
      init = await fetch(`${getApiUrl()}/auth/profile/init`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ flow: role, first_name: data.user.user_metadata?.first_name || '', last_name: data.user.user_metadata?.last_name || '' }), signal: AbortSignal.timeout(PROFILE_INIT_TIMEOUT_MS) })
    } catch (initError) {
      console.error('[auth/callback] profile init failed', initError instanceof Error ? initError.name : 'unknown')
    }
    if (!init?.ok) return NextResponse.redirect(new URL('/auth/auth-code-error?reason=profile_init_failed', origin))
    return NextResponse.redirect(new URL(role === 'admin' ? '/dashboard/school-setup' : role === 'student' ? '/dashboard/student' : '/dashboard', origin))
  }

  const profileResponse = await fetch(`${getApiUrl()}/auth/me`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(PROFILE_INIT_TIMEOUT_MS) }).catch(() => null)
  if (profileResponse?.ok && context.intent === 'login') {
    const body = await profileResponse.json().catch(() => null)
    const destination = postAuthDestination({ role: body?.user?.role as KanviseRole, schoolId: body?.user?.school_id, redirect: context.returnTo })
    const response = NextResponse.redirect(new URL(destination, origin))
    response.cookies.delete(OAUTH_CONTEXT_COOKIE)
    // A new sign-in starts without a previously selected account (DEV-SEC-005).
    response.cookies.delete(ACCOUNT_COOKIE_NAME)
    return response
  }

  return NextResponse.redirect(new URL('/auth/complete-profile', origin))
}
