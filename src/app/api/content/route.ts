import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  // Validate status filter if provided
  if (statusFilter && !VALID_STATUSES.includes(statusFilter as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: 'Invalid status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // Select fields for list view (body needed for ContentCard preview truncation)
  let query = supabase
    .from('content')
    .select('id, type, status, body, framework_id, reminder_at, created_at, updated_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('Content fetch error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to fetch content' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

/**
 * POST /api/content
 * Create new content with moderation.
 * Returns content record with moderation result.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  // Rate limiting (in-memory; use Redis in production for multi-instance deployments)
  if (!checkRateLimit(`content:${user.id}`, RATE_LIMIT_PRESETS.content)) {
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

  // Insert content (using 'as any' to work around Supabase TS inference issues)
  const { data, error } = await (supabase
    .from('content') as any)
    .insert({
      coach_id: user.id,
      type,
      body: contentBody,
      status: 'draft',
      framework_id: framework_id ?? null,
      framework_answers: framework_answers ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Content create error:', error)
    // Handle PostgreSQL constraint violations as 400s
    const constraintErrors: Record<string, string> = {
      '23503': 'Invalid framework_id provided',  // Foreign key violation
      '23505': 'Duplicate content entry',         // Unique violation
      '23514': 'Content validation failed',       // Check constraint violation
      '23502': 'Required field is missing',       // Not-null violation
    }
    if (error.code && constraintErrors[error.code]) {
      return NextResponse.json(
        { error: 'Validation error', message: constraintErrors[error.code] },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to create content' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ...data,
    moderation,
  }, { status: 201 })
}
