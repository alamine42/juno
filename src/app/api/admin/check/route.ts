import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coaches } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hasAdminClaim } from '@/types/clerk'

/**
 * GET /api/admin/check
 *
 * Check if the current user has admin privileges.
 * Returns { isAdmin: boolean }
 */
export async function GET() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return NextResponse.json({ isAdmin: false })
  }

  // Check Clerk session claims first (faster)
  if (hasAdminClaim(sessionClaims)) {
    return NextResponse.json({ isAdmin: true })
  }

  // Fall back to database check
  const [coach] = await db
    .select({ isAdmin: coaches.isAdmin })
    .from(coaches)
    .where(eq(coaches.clerkId, userId))

  return NextResponse.json({ isAdmin: coach?.isAdmin ?? false })
}
