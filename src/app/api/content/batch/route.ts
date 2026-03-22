import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateContent, type BrandProfile } from '@/lib/ai/claude'
import { moderateContent } from '@/lib/moderation'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit'
import { FRAMEWORKS } from '@/lib/frameworks'

// Allow longer execution for batch generation
export const maxDuration = 60

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

// Per-day customization from the UI
const dayConfigSchema = z.object({
  day: z.enum(VALID_DAYS),
  framework_id: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
})

const batchCreateSchema = z.object({
  focus_topic: z.string().min(1, 'Focus topic is required').max(500),
  posting_days: z.array(z.enum(VALID_DAYS))
    .min(1, 'At least one posting day is required')
    .max(7, 'Maximum 7 posting days allowed'),
  promotion_text: z.string().max(500).optional(),
  // Optional per-day customizations from the modal UI
  day_configs: z.array(dayConfigSchema).optional(),
})

// Helper to add delay between API calls
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Select a framework for each day to create variety
function selectFrameworkForDay(dayIndex: number): typeof FRAMEWORKS[number] {
  // Rotate through frameworks to ensure variety
  return FRAMEWORKS[dayIndex % FRAMEWORKS.length]
}

// Build a prompt for batch content generation
function buildBatchPrompt(
  framework: typeof FRAMEWORKS[number],
  focusTopic: string,
  dayName: string,
  promotionText?: string
): string {
  const basePrompt = `Create an Instagram ${framework.output_type === 'carousel_script' ? 'carousel' : 'post'} for ${dayName}.

Topic focus: ${focusTopic}
Content type: ${framework.name} - ${framework.description}

${promotionText ? `Include this promotion naturally: ${promotionText}` : ''}

Follow the ${framework.name} format and make it engaging for a fitness/wellness audience.`

  return basePrompt
}

interface BatchContentItem {
  id: string
  day: string
  framework: string
  body: string
  status: string
  moderation: { rating: string; reasons: string[] }
}

/**
 * POST /api/content/batch
 * Generate a week's worth of content in one request.
 * Creates content_batches record and generates content for each posting day.
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
  // Stricter limit for batch - expensive operation (5 req/min)
  if (!checkRateLimit(`batch:${user.id}`, RATE_LIMIT_PRESETS.batch)) {
    return NextResponse.json(
      { error: 'Rate limited', message: 'Too many batch requests. Please wait a moment.' },
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

  const parsed = batchCreateSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.flatten()
    const firstError = errors.fieldErrors.focus_topic?.[0]
      || errors.fieldErrors.posting_days?.[0]
      || 'Invalid request data'
    return NextResponse.json(
      { error: 'Validation failed', message: firstError, details: errors },
      { status: 400 }
    )
  }

  const { focus_topic, posting_days, promotion_text, day_configs } = parsed.data

  // Load brand profile for content generation
  const { data: brandProfile, error: profileError } = await supabase
    .from('brand_profiles')
    .select('style_words, tone, emoji_usage, sign_off, avoided_topics, avoided_words, preferred_words, target_audience, example_posts')
    .eq('coach_id', user.id)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Brand profile fetch error:', profileError)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to load brand profile' },
      { status: 500 }
    )
  }

  // Create batch record
  const { data: batch, error: batchError } = await (supabase
    .from('content_batches') as any)
    .insert({
      coach_id: user.id,
      focus_topic,
      posting_days,
      has_promotion: !!promotion_text,
      promotion_text: promotion_text ?? null,
      status: 'generating',
    })
    .select()
    .single()

  if (batchError || !batch) {
    console.error('Batch create error:', batchError)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to create batch' },
      { status: 500 }
    )
  }

  const batchId = batch.id
  const contentItems: BatchContentItem[] = []
  let failureCount = 0

  // Generate content for each posting day sequentially
  for (let i = 0; i < posting_days.length; i++) {
    const day = posting_days[i]

    // Use per-day customization if provided, otherwise fall back to rotation
    const dayConfig = day_configs?.find(c => c.day === day)
    const customFramework = dayConfig?.framework_id
      ? FRAMEWORKS.find(f => f.id === dayConfig.framework_id)
      : null
    const framework = customFramework || selectFrameworkForDay(i)
    const customTopic = dayConfig?.topic?.trim()

    // Add delay between API calls (except for the first one)
    if (i > 0) {
      await delay(500)
    }

    try {
      // Use custom topic if provided, otherwise use the general focus topic
      const topicForDay = customTopic || focus_topic
      const prompt = buildBatchPrompt(framework, topicForDay, day, promotion_text)

      const result = await generateContent(
        prompt,
        brandProfile as BrandProfile | null,
        []
      )

      if (!result.success) {
        console.error(`Batch generation failed for day ${day}:`, result.error)
        failureCount++
        continue
      }

      // Run moderation
      const moderation = moderateContent(result.content)

      // Skip red content but don't fail the whole batch
      if (moderation.rating === 'red') {
        console.warn(`Red content generated for day ${day}, skipping`)
        failureCount++
        continue
      }

      // Insert content row
      const { data: contentData, error: contentError } = await (supabase
        .from('content') as any)
        .insert({
          coach_id: user.id,
          type: framework.output_type,
          status: 'draft',
          body: result.content,
          framework_id: framework.id,
          batch_id: batchId,
          batch_position: i + 1,
        })
        .select()
        .single()

      if (contentError) {
        console.error(`Content insert failed for day ${day}:`, contentError)
        failureCount++
        continue
      }

      contentItems.push({
        id: contentData.id,
        day,
        framework: framework.name,
        body: result.content,
        status: 'draft',
        moderation,
      })
    } catch (err) {
      console.error(`Unexpected error for day ${day}:`, err)
      failureCount++
    }
  }

  // Update batch status based on results
  const finalStatus = failureCount === 0
    ? 'ready'
    : failureCount === posting_days.length
      ? 'failed'
      : 'partial'

  const { error: updateError } = await (supabase
    .from('content_batches') as any)
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchId)

  if (updateError) {
    console.error('Batch status update error:', updateError)
    // Still return results but warn about status update failure
  }

  // Use appropriate HTTP status based on outcome
  const httpStatus = finalStatus === 'failed' ? 500
    : finalStatus === 'partial' ? 207  // Multi-Status
    : 201

  return NextResponse.json({
    batchId,
    status: finalStatus,
    content: contentItems,
    generated: contentItems.length,
    failed: failureCount,
    ...(updateError && { warning: 'Batch status update failed' }),
  }, { status: httpStatus })
}
