import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { content } from '@/lib/db/schema'
import { getOrCreateCoach } from '@/lib/db/helpers'
import { eq, and } from 'drizzle-orm'
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
 * Returns 404 if not found or belongs to another coach.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const coach = await getOrCreateCoach()

    const [data] = await db
      .select({
        id: content.id,
        type: content.type,
        status: content.status,
        body: content.body,
        frameworkId: content.frameworkId,
        frameworkAnswers: content.frameworkAnswers,
        batchId: content.batchId,
        batchPosition: content.batchPosition,
        reminderAt: content.reminderAt,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
      })
      .from(content)
      .where(and(eq(content.id, id), eq(content.coachId, coach.id)))

    if (!data) {
      return NextResponse.json(
        { error: 'Not found', message: 'Content not found' },
        { status: 404 }
      )
    }

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
 * PATCH /api/content/[id]
 * Update content body, status, or reminder_at.
 * Re-runs moderation if body is updated.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const coach = await getOrCreateCoach()

    // Verify ownership first
    const [existing] = await db
      .select({ id: content.id })
      .from(content)
      .where(and(eq(content.id, id), eq(content.coachId, coach.id)))

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

    const [data] = await db
      .update(content)
      .set({
        ...(updateData.body && { body: updateData.body }),
        ...(updateData.status && { status: updateData.status }),
        ...(updateData.reminder_at !== undefined && { reminderAt: updateData.reminder_at ? new Date(updateData.reminder_at) : null }),
        updatedAt: new Date(),
      })
      .where(and(eq(content.id, id), eq(content.coachId, coach.id)))
      .returning()

    return NextResponse.json({
      ...data,
      ...(moderation && { moderation }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
    console.error('Content update error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to update content' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/content/[id]
 * Hard delete a content item.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const coach = await getOrCreateCoach()

    // Verify ownership first
    const [existing] = await db
      .select({ id: content.id })
      .from(content)
      .where(and(eq(content.id, id), eq(content.coachId, coach.id)))

    if (!existing) {
      return NextResponse.json(
        { error: 'Not found', message: 'Content not found' },
        { status: 404 }
      )
    }

    await db
      .delete(content)
      .where(and(eq(content.id, id), eq(content.coachId, coach.id)))

    return NextResponse.json({ deleted: true }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
    console.error('Content delete error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to delete content' },
      { status: 500 }
    )
  }
}
