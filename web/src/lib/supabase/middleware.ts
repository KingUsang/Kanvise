import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { postAuthDestination, type KanviseRole } from '@/lib/auth-continuation'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')
  const isAccountSetupRoute = request.nextUrl.pathname.startsWith('/account/setup')
  const isAccountPickerRoute = request.nextUrl.pathname.startsWith('/account/select')
  const isProtectedRoute = isDashboardRoute || isAccountSetupRoute || isAccountPickerRoute

  let claims: Record<string, any> | null = null
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error) {
      const isTemporaryAuthFailure = error.name === 'AuthRetryableFetchError' || error.status === 0
      if (isTemporaryAuthFailure && isProtectedRoute) {
        const unavailableUrl = request.nextUrl.clone()
        unavailableUrl.pathname = '/auth/service-unavailable'
        unavailableUrl.search = ''
        return NextResponse.rewrite(unavailableUrl, { status: 503 })
      }
    } else {
      claims = (data?.claims as Record<string, any> | undefined) || null
    }
  } catch (error) {
    console.error('auth.middleware_claims_unavailable', {
      path: request.nextUrl.pathname,
      message: error instanceof Error ? error.message : 'Unknown Auth error',
    })
    if (isProtectedRoute) {
      const unavailableUrl = request.nextUrl.clone()
      unavailableUrl.pathname = '/auth/service-unavailable'
      unavailableUrl.search = ''
      return NextResponse.rewrite(unavailableUrl, { status: 503 })
    }
  }
  
  if (!claims && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.search = ''
    const redirect = safeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`)
    if (redirect) url.searchParams.set('redirect', redirect)
    return NextResponse.redirect(url)
  }

  if (claims) {
    // Route redirects improve UX only; API/RLS still enforce permissions.
    // app_metadata is the only claim source accepted for role hints.
    const appMetadata = claims.app_metadata || {}
    const kanvise_role = appMetadata.kanvise_role || appMetadata.role || 'student'
    const schoolId = appMetadata.school_id
    const needsAdminSetup = kanvise_role === 'admin' && !schoolId
    // Redirect logged in users away from auth routes (unless they are doing a password reset or similar)
    const isPasswordSetupRoute = request.nextUrl.pathname.includes('reset-password')
      || request.nextUrl.pathname.includes('accept-invitation')
      || request.nextUrl.pathname.includes('complete-invitation')
      || request.nextUrl.pathname.includes('complete-profile')
      || request.nextUrl.pathname.includes('/auth/invitation')
    if (isAuthRoute && !isPasswordSetupRoute) {
      const url = request.nextUrl.clone()
      const destination = postAuthDestination({
        role: kanvise_role as KanviseRole,
        schoolId,
        redirect: request.nextUrl.searchParams.get('redirect') || request.nextUrl.searchParams.get('return_to'),
      })
      const resolved = new URL(destination, request.url)
      url.pathname = resolved.pathname
      url.search = resolved.search
      url.hash = resolved.hash
      return NextResponse.redirect(url)
    }

    if (isDashboardRoute) {
      if (needsAdminSetup && request.nextUrl.pathname !== '/dashboard/school-setup') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/school-setup'
        return NextResponse.redirect(url)
      }

      if (request.nextUrl.pathname === '/dashboard') {
        if (kanvise_role === 'student') {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard/student'
          return NextResponse.redirect(url)
        }
        // Admin and tutor are allowed at /dashboard
      } else if (request.nextUrl.pathname === '/dashboard/student' || request.nextUrl.pathname.startsWith('/dashboard/student/')) {
        if (kanvise_role !== 'student') {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }
      } else if (kanvise_role === 'student') {
        // Student trying to access some non-student dashboard route (e.g. /dashboard/school-setup)
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/student'
        return NextResponse.redirect(url)
      }
      // A tutor who opens an admin-only URL is not redirected: the dashboard
      // shell renders the Not available page in place (01-app-shell SH-14a)
      // before any page code runs, and the API checks every request.
    }
  }

  return supabaseResponse
}
