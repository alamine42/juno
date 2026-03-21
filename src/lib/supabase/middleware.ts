import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

// Routes that require authentication
const PROTECTED_ROUTES = ['/chat', '/drafts', '/onboarding', '/settings']

// Routes that require admin access
const ADMIN_ROUTES = ['/admin']

// API routes that should return 401 JSON instead of redirect
const API_PREFIX = '/api/'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
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

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Check if this is an API route
  const isApiRoute = pathname.startsWith(API_PREFIX)

  // Check if this is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  // Check if this is an admin route
  const isAdminRoute = ADMIN_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  // Handle unauthenticated users
  if (!user) {
    if (isApiRoute) {
      // Return 401 JSON for API routes
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    if (isProtectedRoute || isAdminRoute) {
      // Redirect to login for protected routes
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // User is authenticated - check admin access
  if (isAdminRoute) {
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail || user.email !== adminEmail) {
      // Not an admin - redirect to chat
      const url = request.nextUrl.clone()
      url.pathname = '/chat'
      return NextResponse.redirect(url)
    }
  }

  // Check onboarding status for authenticated users on protected routes
  // (except onboarding itself)
  if (isProtectedRoute && !pathname.startsWith('/onboarding')) {
    const { data: brandProfile } = await (supabase
      .from('brand_profiles') as any)
      .select('completed_at, skipped_count')
      .eq('coach_id', user.id)
      .single() as { data: { completed_at: string | null; skipped_count: number } | null }

    // Redirect to onboarding if:
    // - No brand profile exists, OR
    // - Brand profile not completed AND not skipped
    const needsOnboarding =
      !brandProfile ||
      (!brandProfile.completed_at && (brandProfile.skipped_count || 0) === 0)

    if (needsOnboarding) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
