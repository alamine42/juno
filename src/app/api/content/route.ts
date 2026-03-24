import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { content } from '@/lib/db/schema'
import { getOrCreateCoach } from '@/lib/db/helpers'
import { eq, desc } from 'drizzle-orm'
import { moderateContent } from '@/lib/moderation'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit'

const VALID_TYPES = ['caption', 'carousel_script'] as const
const VALID_STATUSES = ['draft', 'reminder_set', 'posted'] as const

const contentCreateSchema = z.object({
  type: z.enum(VALID_TYPES),
  body: z.string().min(1, 'Body is required').max(3000, 'Body exceeds 3000 characters'),
  framework_id: z.string().optional(),
  framework_answers: z.record(z.string()).optional(),
})

/**
 * GET /api/content
 * List coach's content ordered by created_at DESC.
 * Optional ?status= filter.
 * LIMIT 100.
 */
export async function GET(request: NextRequest) {
  try {
    const coach = await getOrCreateCoach()

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Validate status filter if provided
    if (statusFilter && !VALID_STATUSES.includes(statusFilter as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    let query = db
      .select({
        id: content.id,
        type: content.type,
        status: content.status,
        body: content.body,
        frameworkId: content.frameworkId,
        reminderAt: content.reminderAt,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
      })
      .from(content)
      .where(eq(content.coachId, coach.id))
      .orderBy(desc(content.createdAt))
      .limit(100)
      .$dynamic()

    if (statusFilter) {
      query = query.where(eq(content.status, statusFilter))
    }

    const data = await query

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
    console.error('Content fetch error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to fetch content' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/content
 * Create new content with moderation.
 * Returns content record with moderation result.
 */
export async function POST(request: NextRequest) {
  try {
    const coach = await getOrCreateCoach()

    // Rate limiting (in-memory; use Redis in production for multi-instance deployments)
    if (!checkRateLimit(`content:${coach.id}`, RATE_LIMIT_PRESETS.content)) {
      return NextResponse.json(
        { error: 'Rate limited', message: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON', message: 'Request body must be valid JSON' },
        { status: 400 }
      )
    }

    const parsed = contentCreateSchema.safeParse(body)
    if (!parsed.success) {
      const errors = parsed.error.flatten()
      const firstError = errors.fieldErrors.type?.[0]
        || errors.fieldErrors.body?.[0]
        || 'Invalid request data'
      return NextResponse.json(
        { error: 'Validation failed', message: firstError, details: errors },
        { status: 400 }
      )
    }

    const { type, body: contentBody, framework_id, framework_answers } = parsed.data

    // Run moderation
    const moderation = moderateContent(contentBody)

    // Block red-rated content (dangerous health claims, legal risk)
    if (moderation.rating === 'red') {
      return NextResponse.json(
        {
          error: 'Content blocked',
          message: 'This content contains prohibited terms and cannot be saved.',
          moderation,
        },
        { status: 422 }
      )
    }

    // Insert content
    const [data] = await db
      .insert(content)
      .values({
        coachId: coach.id,
        type,
        body: contentBody,
        status: 'draft',
        frameworkId: framework_id ?? null,
        frameworkAnswers: framework_answers ?? null,
      })
      .returning()

    return NextResponse.json({
      ...data,
      moderation,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
    console.error('Content create error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to create content' },
      { status: 500 }
    )
  }
}
