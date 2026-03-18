import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=missing_code`
    )
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Auth callback error:', exchangeError.message)
    return NextResponse.redirect(
      `${origin}/auth/login?error=auth_failed`
    )
  }

  // Check if the user has completed onboarding
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('brand_profiles')
      .select('completed_at')
      .eq('coach_id', user.id)
      .single<{ completed_at: string | null }>()

    // Redirect to onboarding if brand profile is not completed
    if (!profile?.completed_at) {
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  return NextResponse.redirect(`${origin}/chat`)
}
