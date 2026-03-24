import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { hasAdminClaim } from '@/types/clerk'

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/cron/(.*)',
  '/api/health',
])

// Admin routes that require admin access
const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Protect all other routes
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Check admin access for admin routes
  if (isAdminRoute(req)) {
    const isAdmin = hasAdminClaim(sessionClaims)
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/chat', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
