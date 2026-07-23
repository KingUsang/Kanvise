import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getDashboardAccess } from '@/config/dashboard-navigation'

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
  const isJoinRoute = request.nextUrl.pathname.startsWith('/join')
  const isAccountSetupRoute = request.nextUrl.pathname.startsWith('/account/setup')
  const isProtectedRoute = isDashboardRoute || isAccountSetupRoute

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
    return NextResponse.redirect(url)
  }

  if (claims) {
    // Route redirects improve UX only; API/RLS still enforce permissions.
    // Prefer server-controlled app_metadata and retain a legacy fallback until
    // existing sessions have refreshed.
    const appMetadata = claims.app_metadata || {}
    const userMetadata = claims.user_metadata || {}
    const kanvise_role = appMetadata.kanvise_role || appMetadata.role || userMetadata.kanvise_role || 'student'
    const schoolId = appMetadata.school_id
    const needsAdminSetup = kanvise_role === 'admin' && !schoolId
    // Redirect logged in users away from auth routes (unless they are doing a password reset or similar)
    if (isAuthRoute && !request.nextUrl.pathname.includes('reset-password')) {
      const url = request.nextUrl.clone()
      if (needsAdminSetup) {
        url.pathname = '/dashboard/school-setup'
      } else if (kanvise_role === 'admin' || kanvise_role === 'tutor') {
        url.pathname = '/dashboard'
      } else {
        url.pathname = '/dashboard/student' // Default
      }
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
      } else if (kanvise_role === 'tutor' && getDashboardAccess(request.nextUrl.pathname) === 'admin') {
        // Do not rely on hidden navigation: stop a tutor who types or follows an
        // admin-only URL before any page code or API request runs.
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        url.searchParams.set('notice', 'not-authorised')
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
