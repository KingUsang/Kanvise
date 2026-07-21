import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  console.log('\n=== AUTH CALLBACK TRIGGERED ===')
  console.log('Full Request URL:', request.url)
  
  const code = searchParams.get('code')
  console.log('Extracted Code:', code ? 'YES (Hidden for security)' : 'NO CODE FOUND')
  const next = searchParams.get('next') ?? '/'
  const role = searchParams.get('role') // from the email redirect url
  const redirect = searchParams.get('redirect') // specific course redirect
  const inviteToken = searchParams.get('invite_token')

  if (code) {
    console.log('Attempting to exchange code for session...')
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('❌ Supabase Exchange Error:', error.message)
      console.error('Error Details:', error)
    } else {
      console.log('✅ Exchange Success! User ID:', data?.user?.id)
    }

    if (!error && data.user) {
      // If there is no role attached to the verification link, it might be a password reset flow
      if (!role) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // We need to call Hono to initialize the user profile
      const user = data.user
      // In a real browser context, we would need to pass the invite_token if the user is a tutor.
      // However, we can't read sessionStorage from a Server Route.
      // The Next.js API route could either:
      // 1. Pass the token as a query parameter in the callback URL initially (when calling signUp).
      // Since we didn't do that, we will handle `invite_token` by making the Client Component 
      // check for the token after login and hit the profile/init endpoint itself if the server didn't.
      // Alternatively, we can let the Client handle the profile initialization.

      // For MVP, we will construct the Hono call here.
      try {
        const honoApiUrl = process.env.NEXT_PUBLIC_API_URL
        
        console.log(`Pinging Hono backend at: ${honoApiUrl}/auth/profile/init`)
        const response = await fetch(`${honoApiUrl}/auth/profile/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({
            supabase_auth_id: user.id,
            email: user.email,
            role: role,
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            invite_token: inviteToken || undefined
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ Hono API returned status ${response.status}:`, errorText)
        } else {
          console.log('✅ Hono Profile successfully initialized!')
        }
      } catch (err) {
        console.error("❌ Failed to reach Hono API (Network Error):", err)
      }

      // Redirecting...
      let redirectUrl = origin
      
      if (role === 'admin') {
        redirectUrl = `${origin}/dashboard/admin/setup`
      } else if (role === 'tutor') {
        redirectUrl = `${origin}/dashboard/tutor`
      } else if (redirect) {
        redirectUrl = `${origin}${redirect}`
      } else {
        redirectUrl = `${origin}/dashboard/student`
      }
      
      return NextResponse.redirect(redirectUrl)
    }
  } else {
    console.log('❌ Auth callback failed: No "code" parameter found in the URL.')
  }

  console.log('Redirecting user to auth-code-error page...')
  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
