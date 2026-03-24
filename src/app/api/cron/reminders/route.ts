import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { content, coaches, systemHealth } from '@/lib/db/schema'
import { eq, and, lte, isNull } from 'drizzle-orm'
import { sendPostingReminder } from '@/lib/email/resend'
import { moderateContent } from '@/lib/moderation'

// Allow longer execution for processing multiple reminders
export const maxDuration = 60

/**
 * Validate that the request is from Vercel Cron or has valid CRON_SECRET.
 * For GET (automated cron): checks user-agent AND secret.
 * For POST (manual trigger): only requires valid secret.
 */
async function validateCronRequest(isManual: boolean = false): Promise<boolean> {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')
  const authorization = headersList.get('authorization')

  // In development, allow requests without Vercel cron headers
  const isDev = process.env.NODE_ENV === 'development'

  // Validate CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET not configured')
    return false
  }

  const hasValidSecret = authorization === `Bearer ${cronSecret}`

  // Manual triggers only need valid secret (no user-agent check)
  if (isManual) {
    return hasValidSecret
  }

  // Vercel crons send specific user-agent
  const isVercelCron = userAgent?.includes('vercel-cron') || isDev

  return isVercelCron && hasValidSecret
}

/**
 * Process reminder emails for content with reminder_set status.
 * Re-runs moderation before sending to catch any issues.
 */
async function processReminders(): Promise<{
  processed: number
  skipped: number
  errors: number
}> {
  // Get all content due for reminder with coach info
  const contentItems = await db
    .select({
      id: content.id,
      body: content.body,
      coachId: content.coachId,
      coachEmail: coaches.email,
      coachName: coaches.name,
    })
    .from(content)
    .innerJoin(coaches, eq(content.coachId, coaches.id))
    .where(
      and(
        eq(content.status, 'reminder_set'),
        lte(content.reminderAt, new Date()),
        isNull(content.reminderSentAt)
      )
    )

  if (contentItems.length === 0) {
    return { processed: 0, skipped: 0, errors: 0 }
  }

  let processed = 0
  let skipped = 0
  let errors = 0

  // Process each reminder
  for (const item of contentItems) {
    try {
      // Re-run moderation check before sending
      const moderation = moderateContent(item.body)

      // Skip red-flagged content entirely
      if (moderation.rating === 'red') {
        console.warn(`Skipping red-flagged content ${item.id}:`, moderation.reasons)
        skipped++
        continue
      }

      // Get coach info
      const coachEmail = item.coachEmail
      const coachName = item.coachName || 'there'

      // Generate content preview (first 500 chars)
      const contentPreview =
        item.body.length > 500 ? item.body.slice(0, 500) + '...' : item.body

      // Send email - with warning banner for yellow content
      await sendPostingReminder(coachEmail, coachName, contentPreview, item.id, {
        hasWarning: moderation.rating === 'yellow',
        warningReasons: moderation.reasons,
      })

      // Update reminder_sent_at (NOT status - coach manually confirms posting)
      await db
        .update(content)
        .set({ reminderSentAt: new Date() })
        .where(eq(content.id, item.id))

      processed++
    } catch (err) {
      console.error(`Error processing reminder for ${item.id}:`, err)
      errors++
    }
  }

  return { processed, skipped, errors }
}

/**
 * Write cron run stats to system_health table.
 */
async function recordCronHealth(stats: {
  processed: number
  skipped: number
  errors: number
}): Promise<void> {
  const value = {
    timestamp: new Date().toISOString(),
    ...stats,
  }

  try {
    // Upsert the cron health record
    await db
      .insert(systemHealth)
      .values({
        key: 'last_cron_run',
        value,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemHealth.key,
        set: {
          value,
          updatedAt: new Date(),
        },
      })
  } catch (error) {
    console.error('Failed to record cron health:', error)
    // Don't throw - this is non-critical
  }
}

/**
 * GET /api/cron/reminders
 *
 * Vercel Cron endpoint - runs every 30 minutes.
 * Processes due posting reminders with moderation checks.
 */
export async function GET() {
  // Validate cron request (requires Vercel user-agent)
  const isValid = await validateCronRequest(false)
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await processReminders()
    await recordCronHealth(stats)

    // Return minimal response for automated cron (no counts to avoid info leak)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Cron reminders failed:', err)

    // Record error state
    await recordCronHealth({ processed: 0, skipped: 0, errors: 1 })

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/cron/reminders
 *
 * Manual trigger for testing/demos.
 * Only requires CRON_SECRET, no user-agent check.
 * Returns processing stats for verification.
 */
export async function POST() {
  // Validate manual request (only secret, no user-agent check)
  const isValid = await validateCronRequest(true)
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await processReminders()
    await recordCronHealth(stats)

    // Return stats for manual runs (useful for testing/demos)
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    console.error('Manual cron trigger failed:', err)

    // Record error state
    await recordCronHealth({ processed: 0, skipped: 0, errors: 1 })

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
