import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { UpdateTables } from '@/types/database'

const VALID_TONES = ['motivational', 'educational', 'casual', 'professional', 'raw'] as const
const VALID_EMOJI = ['never', 'sparingly', 'frequently', 'heavily'] as const

const profileUpdateSchema = z.object({
  style_words: z.string().max(500).optional(), // Truncated to 255 after validation
  tone: z.enum(VALID_TONES).optional(),
  emoji_usage: z.enum(VALID_EMOJI).optional(),
  sign_off: z.string().max(500).optional(),
  avoided_topics: z.array(z.string().max(100)).max(20).optional(),
  avoided_words: z.array(z.string().max(50)).max(50).optional(),
  preferred_words: z.array(z.string().max(50)).max(50).optional(),
  target_audience: z.string().max(500).optional(),
  example_posts: z.array(z.string().max(2000)).max(5).optional(),
  skip: z.boolean().optional(),
}).strict()

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('coach_id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { skip, ...profileData } = parsed.data

  // Handle skip
  if (skip) {
    const { data: current } = await supabase
      .from('brand_profiles')
      .select('skipped_count')
      .eq('coach_id', user.id)
      .single<{ skipped_count: number }>()

    await (supabase
      .from('brand_profiles') as any)
      .update({ skipped_count: (current?.skipped_count ?? 0) + 1 })
      .eq('coach_id', user.id)

    return NextResponse.json({ skipped: true })
  }

  // Truncate style_words if needed
  if (profileData.style_words && profileData.style_words.length > 255) {
    profileData.style_words = profileData.style_words.slice(0, 255)
  }

  // Determine if this completes the profile (all 5 required fields present)
  const updateData: Record<string, unknown> = { ...profileData }

  // If all required fields are being set, mark as completed
  const hasAllRequired = profileData.style_words && profileData.tone && profileData.emoji_usage && profileData.sign_off && profileData.avoided_topics
  if (hasAllRequired) {
    updateData.completed_at = new Date().toISOString()
  }

  const { data, error } = await (supabase
    .from('brand_profiles') as any)
    .update(updateData)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json(data)
}
