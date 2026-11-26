import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOAuthContext, OAUTH_CONTEXT_COOKIE, OAUTH_CONTEXT_TTL_SECONDS, type OAuthIntent } from '@/lib/auth/oauth-context'
import { safeRedirectPath } from '@/lib/safe-redirect'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const intent = url.searchParams.get('intent') as OAuthIntent | null
  if (!intent || !['login', 'educator', 'student', 'invitation'].includes(intent)) {
    return NextResponse.redirect(new URL('/auth/auth-code-error?reason=invalid_context', url.origin))
  }

  const registrationIntent = url.searchParams.get('registration_intent') || undefined
  const invitationToken = url.searchParams.get('invitation_token') || undefined
  if ((intent === 'student' && !registrationIntent) || (intent === 'invitation' && !invitationToken)) {
    return NextResponse.redirect(new URL('/auth/auth-code-error?reason=missing_context', url.origin))
  }

  try {
    const supabase = await createClient()
    const callback = new URL('/api/auth/callback', url.origin)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
    })
    if (error || !data.url) throw error || new Error('Google sign-in could not be started')

    const response = NextResponse.redirect(data.url)
    response.cookies.set(OAUTH_CONTEXT_COOKIE, createOAuthContext({
      intent,
      returnTo: safeRedirectPath(url.searchParams.get('return_to')) || undefined,
      registrationIntent,
      invitationToken,
      accountType: url.searchParams.get('account_type') === 'centre' ? 'centre' : 'independent',
      agencyName: url.searchParams.get('agency_name') || undefined,
    }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: OAUTH_CONTEXT_TTL_SECONDS,
      path: '/',
    })
    return response
  } catch (error) {
    console.error('[auth/google] start failed', error)
    return NextResponse.redirect(new URL('/auth/auth-code-error?reason=provider_unavailable', url.origin))
  }
}
