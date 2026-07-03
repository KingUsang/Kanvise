import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')
  const isJoinRoute = request.nextUrl.pathname.startsWith('/join')
  const isAccountSetupRoute = request.nextUrl.pathname.startsWith('/account/setup')
  
  if (!user && (isDashboardRoute || isAccountSetupRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const kanvise_role = user.user_metadata?.kanvise_role
    
    // Redirect logged in users away from auth routes (unless they are doing a password reset or similar)
    if (isAuthRoute && !request.nextUrl.pathname.includes('reset-password')) {
      const url = request.nextUrl.clone()
      if (kanvise_role === 'admin') url.pathname = '/dashboard/admin'
      else if (kanvise_role === 'tutor') url.pathname = '/dashboard/tutor'
      else url.pathname = '/dashboard/student' // Default
      return NextResponse.redirect(url)
    }

    if (isDashboardRoute) {
      if (request.nextUrl.pathname.startsWith('/dashboard/admin') && kanvise_role !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/' + (kanvise_role || 'student')
        return NextResponse.redirect(url)
      }
      
      if (request.nextUrl.pathname.startsWith('/dashboard/tutor') && kanvise_role !== 'tutor') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/' + (kanvise_role || 'student')
        return NextResponse.redirect(url)
      }
      
      if (request.nextUrl.pathname.startsWith('/dashboard/student') && kanvise_role !== 'student') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/' + (kanvise_role || 'student')
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
