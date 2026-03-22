import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { moderateContent } from '@/lib/moderation'

const VALID_STATUSES = ['draft', 'reminder_set', 'posted'] as const

const contentUpdateSchema = z.object({
  body: z.string().min(1).max(3000).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  reminder_at: z.string().datetime().optional().nullable(),
}).strict().refine(
  data => data.body !== undefined || data.status !== undefined || data.reminder_at !== undefined,
  { message: 'At least one field (body, status, or reminder_at) must be provided' }
)

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/content/[id]
 * Get a single content item by ID.
 * Returns 404 if not found or belongs to another coach (RLS).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from('content')
    .select('id, type, status, body, framework_id, framework_answers, batch_id, batch_position, reminder_at, created_at, updated_at')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (error) {
    // PGRST116 = no rows found (RLS filtered or doesn't exist)
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Not found', message: 'Content not found' },
        { status: 404 }
      )
    }
    console.error('Content fetch error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to fetch content' },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Not found', message: 'Content not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/content/[id]
 * Update content body, status, or reminder_at.
 * Re-runs moderation if body is updated.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  // Verify ownership first
  const { data: existing, error: fetchError } = await supabase
    .from('content')
    .select('id')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Not found', message: 'Content not found' },
        { status: 404 }
      )
    }
    console.error('Content ownership check error:', fetchError)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to verify content ownership' },
      { status: 500 }
    )
  }

  if (!existing) {
    return NextResponse.json(
      { error: 'Not found', message: 'Content not found' },
      { status: 404 }
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

  const parsed = contentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.flatten()
    const firstError = errors.fieldErrors.body?.[0]
      || errors.fieldErrors.status?.[0]
      || errors.fieldErrors.reminder_at?.[0]
      || 'Invalid request data'
    return NextResponse.json(
      { error: 'Validation failed', message: firstError, details: errors },
      { status: 400 }
    )
  }

  const updateData = parsed.data

  // If body is being updated, re-run moderation
  let moderation = null
  if (updateData.body) {
    moderation = moderateContent(updateData.body)
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
  }

  const { data, error } = await (supabase
    .from('content') as any)
    .update(updateData)
    .eq('id', id)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Content update error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to update content' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ...data,
    ...(moderation && { moderation }),
  })
}

/**
 * DELETE /api/content/[id]
 * Hard delete a content item.
 * RLS enforces ownership.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  // Verify ownership first
  const { data: existing, error: fetchError } = await supabase
    .from('content')
    .select('id')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Not found', message: 'Content not found' },
        { status: 404 }
      )
    }
    console.error('Content ownership check error:', fetchError)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to verify content ownership' },
      { status: 500 }
    )
  }

  if (!existing) {
    return NextResponse.json(
      { error: 'Not found', message: 'Content not found' },
      { status: 404 }
    )
  }

  const { error } = await (supabase
    .from('content') as any)
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    console.error('Content delete error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to delete content' },
      { status: 500 }
    )
  }

  return NextResponse.json({ deleted: true }, { status: 200 })
}
