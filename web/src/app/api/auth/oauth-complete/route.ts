import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiUrl } from '@/config/api'
import { defaultDestination, postAuthDestination, type KanviseRole } from '@/lib/auth-continuation'
import { OAUTH_CONTEXT_COOKIE, readOAuthContext } from '@/lib/auth/oauth-context'

export async function POST(request: Request) {
  const context = readOAuthContext((await cookies()).get(OAUTH_CONTEXT_COOKIE)?.value)
  if (!context) return NextResponse.json({ error: 'Your sign-in session has expired. Start again.' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const firstName = String(body?.first_name || '').trim(), lastName = String(body?.last_name || '').trim(), centreName = String(body?.centre_name || '').trim()
  if (!firstName || !lastName) return NextResponse.json({ error: 'Enter your first and last name.' }, { status: 400 })
  if (context.intent === 'educator' && context.accountType === 'centre' && !centreName) return NextResponse.json({ error: 'Enter your tutoring agency name.' }, { status: 400 })
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Your Google session has expired. Start again.' }, { status: 401 })

  const existing = await fetch(`${getApiUrl()}/auth/me`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
  if (existing.ok && context.intent !== 'invitation') {
    const existingBody = await existing.json()
    if (context.intent === 'student' && existingBody.user.role !== 'student') return NextResponse.json({ error: 'This Google account belongs to a staff account. Use a student account to continue.' }, { status: 409 })
    const response = NextResponse.json({ destination: postAuthDestination({ role: existingBody.user.role as KanviseRole, schoolId: existingBody.user.school_id, redirect: context.returnTo }) })
    response.cookies.delete(OAUTH_CONTEXT_COOKIE)
    return response
  }

  const invitationRole = body?.invitation_role === 'student' ? 'student' : 'tutor'
  const flow = context.intent === 'student' ? 'student' : context.intent === 'invitation' ? invitationRole : context.accountType === 'centre' ? 'centre' : 'independent'
  const init = await fetch(`${getApiUrl()}/auth/profile/init`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ flow, first_name: firstName, last_name: lastName, student_registration_token: context.registrationIntent, account_invitation_token: context.invitationToken }) })
  const initBody = await init.json().catch(() => null)
  if (!init.ok) {
    const invitationEmailMismatch = context.intent === 'invitation'
      && init.status === 403
      && initBody?.error === 'This invitation was sent to a different email address'
    return NextResponse.json({
      error: invitationEmailMismatch ? 'This invitation was sent to a different email address. Sign in with the invited account to continue.' : initBody?.error || 'Your Kanvise profile could not be completed.',
      code: invitationEmailMismatch ? 'INVITATION_EMAIL_MISMATCH' : undefined,
    }, { status: init.status })
  }

  let schoolId = initBody?.profile?.school_id || null
  if (flow === 'centre' || flow === 'independent') {
    const refreshed = await supabase.auth.refreshSession()
    const accessToken = refreshed.data.session?.access_token
    if (!accessToken) return NextResponse.json({ error: 'Your profile was created, but your session could not be refreshed.' }, { status: 500 })
    const school = await fetch(`${getApiUrl()}/schools`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ name: flow === 'independent' ? `${firstName} ${lastName}` : centreName, account_type: flow }) })
    const schoolBody = await school.json().catch(() => null)
    if (!school.ok && schoolBody?.code !== 'SCHOOL_ALREADY_CONFIGURED') return NextResponse.json({ error: schoolBody?.error || 'Your tutorial workspace could not be created.' }, { status: school.status })
    schoolId = (await supabase.auth.refreshSession()).data.session?.user.app_metadata?.school_id || schoolId
  } else await supabase.auth.refreshSession()

  const role = flow === 'student' ? 'student' : flow === 'tutor' ? 'tutor' : 'admin'
  const response = NextResponse.json({ destination: context.returnTo || defaultDestination(role, schoolId) })
  response.cookies.delete(OAUTH_CONTEXT_COOKIE)
  return response
}
