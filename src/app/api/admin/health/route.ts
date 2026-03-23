import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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
 * Requires is_admin=true flag in coaches table.
 *
 * Returns:
 * - Database connection status
 * - Cron job health (last run, status, stats)
 * - Overall system status
 */
export async function GET() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin flag in database (not email comparison)
  // Use service client for this query since is_admin column may not be in RLS
  const serviceClient = createServiceClient()
  const { data: coach, error: coachError } = await serviceClient
    .from('coaches')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (coachError || !coach?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check database health by attempting a simple query
  let databaseStatus: 'ok' | 'error' = 'ok'
  try {
    const { error } = await serviceClient.from('coaches').select('id').limit(1)
    if (error) {
      databaseStatus = 'error'
    }
  } catch {
    databaseStatus = 'error'
  }

  // Get cron health from system_health table
  let cronHealth: AdminHealthResponse['services']['cron'] = {
    lastRun: null,
    status: 'never',
  }

  try {
    const { data: healthData } = await serviceClient
      .from('system_health')
      .select('value, updated_at')
      .eq('key', 'last_cron_run')
      .single()

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
