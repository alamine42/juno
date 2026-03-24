import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { brandProfiles } from '@/lib/db/schema'
import { getOrCreateCoach, getBrandProfile, getOrCreateBrandProfile } from '@/lib/db/helpers'
import { eq } from 'drizzle-orm'

const VALID_TONES = ['motivational', 'educational', 'casual', 'professional', 'raw'] as const
const VALID_EMOJI = ['never', 'sparingly', 'frequently', 'heavily'] as const

const profileUpdateSchema = z.object({
  style_words: z.string().max(500).optional(),
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

export async function GET() {
  try {
    const coach = await getOrCreateCoach()
    const profile = await getBrandProfile(coach.id)

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const coach = await getOrCreateCoach()

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

    // Ensure brand profile exists
    const existingProfile = await getOrCreateBrandProfile(coach.id)

    // Handle skip
    if (skip) {
      await db
        .update(brandProfiles)
        .set({ skippedCount: (existingProfile.skippedCount ?? 0) + 1 })
        .where(eq(brandProfiles.coachId, coach.id))

      return NextResponse.json({ skipped: true })
    }

    // Truncate style_words if needed
    let styleWords = profileData.style_words
    if (styleWords && styleWords.length > 255) {
      styleWords = styleWords.slice(0, 255)
    }

    // Determine if this completes the profile (all 5 required fields present)
    const hasAllRequired =
      profileData.style_words &&
      profileData.tone &&
      profileData.emoji_usage &&
      profileData.sign_off &&
      profileData.avoided_topics

    const [updatedProfile] = await db
      .update(brandProfiles)
      .set({
        styleWords,
        tone: profileData.tone,
        emojiUsage: profileData.emoji_usage,
        signOff: profileData.sign_off,
        avoidedTopics: profileData.avoided_topics,
        avoidedWords: profileData.avoided_words,
        preferredWords: profileData.preferred_words,
        targetAudience: profileData.target_audience,
        examplePosts: profileData.example_posts,
        ...(hasAllRequired && { completedAt: new Date() }),
        updatedAt: new Date(),
      })
      .where(eq(brandProfiles.coachId, coach.id))
      .returning()

    return NextResponse.json(updatedProfile)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
