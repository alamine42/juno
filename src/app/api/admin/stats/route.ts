import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coaches, content } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { hasAdminClaim } from '@/types/clerk'

/**
 * GET /api/admin/stats
 *
 * Admin-only stats endpoint.
 * Returns counts for coaches and content.
 */
export async function GET() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin access - first via Clerk claims, then database
  let isAdmin = hasAdminClaim(sessionClaims)

  if (!isAdmin) {
    const [coach] = await db
      .select({ isAdmin: coaches.isAdmin })
      .from(coaches)
      .where(eq(coaches.clerkId, userId))

    isAdmin = coach?.isAdmin ?? false
  }

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get total coaches count
    const [coachCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(coaches)

    // Get total content count
    const [contentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(content)

    // Get content by status
    const contentByStatus = await db
      .select({
        status: content.status,
        count: sql<number>`count(*)`,
      })
      .from(content)
      .groupBy(content.status)

    const statusCounts = { draft: 0, reminder_set: 0, posted: 0 }
    contentByStatus.forEach((row) => {
      if (row.status && row.status in statusCounts) {
        statusCounts[row.status as keyof typeof statusCounts] = Number(row.count)
      }
    })

    return NextResponse.json({
      totalCoaches: Number(coachCount?.count ?? 0),
      totalContent: Number(contentCount?.count ?? 0),
      contentByStatus: statusCounts,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
