import { NextResponse } from 'next/server'

/**
 * GET /api/health
 *
 * Public health check endpoint for uptime monitors (e.g., UptimeRobot, Better Uptime).
 * Returns minimal response - no internal state, database info, or cron status.
 *
 * For full telemetry, use /api/admin/health (requires is_admin=true).
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
