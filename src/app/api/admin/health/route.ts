import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coaches, systemHealth } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hasAdminClaim } from '@/types/clerk'

interface CronHealthValue {
  timestamp: string
  processed: number
  skipped: number
  errors: number
}

interface AdminHealthResponse {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version: string
  services: {
    database: 'ok' | 'error'
    cron: {
      lastRun: string | null
      status: 'ok' | 'stale' | 'never'
      processed?: number
      skipped?: number
      errors?: number
    }
  }
}

/**
 * GET /api/admin/health
 *
 * Admin-only health endpoint with full telemetry.
 * Requires is_admin=true flag in coaches table or Clerk metadata.
 *
 * Returns:
 * - Database connection status
 * - Cron job health (last run, status, stats)
 * - Overall system status
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

  // Check database health by attempting a simple query
  let databaseStatus: 'ok' | 'error' = 'ok'
  try {
    await db.select({ id: coaches.id }).from(coaches).limit(1)
  } catch {
    databaseStatus = 'error'
  }

  // Get cron health from system_health table
  let cronHealth: AdminHealthResponse['services']['cron'] = {
    lastRun: null,
    status: 'never',
  }

  try {
    const [healthData] = await db
      .select({ value: systemHealth.value, updatedAt: systemHealth.updatedAt })
      .from(systemHealth)
      .where(eq(systemHealth.key, 'last_cron_run'))

    if (healthData) {
      const value = healthData.value as unknown as CronHealthValue
      const lastRunTime = new Date(value.timestamp)
      const now = new Date()
      const minutesSinceLastRun = (now.getTime() - lastRunTime.getTime()) / (1000 * 60)

      // Cron runs every 30 minutes - if >45 min since last run, it's stale
      const cronStatus = minutesSinceLastRun > 45 ? 'stale' : 'ok'

      cronHealth = {
        lastRun: value.timestamp,
        status: cronStatus,
        processed: value.processed,
        skipped: value.skipped,
        errors: value.errors,
      }
    }
  } catch {
    // system_health table may not exist yet or be empty
    cronHealth = { lastRun: null, status: 'never' }
  }

  // Determine overall status
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok'
  if (databaseStatus === 'error') {
    overallStatus = 'down'
  } else if (cronHealth.status === 'stale') {
    overallStatus = 'degraded'
  }

  const response: AdminHealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: databaseStatus,
      cron: cronHealth,
    },
  }

  return NextResponse.json(response)
}
