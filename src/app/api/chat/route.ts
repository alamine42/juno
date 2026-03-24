import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { chatMessages, content, brandProfiles } from '@/lib/db/schema'
import { getOrCreateCoach } from '@/lib/db/helpers'
import { eq, asc } from 'drizzle-orm'
import { generateContent, type BrandProfile } from '@/lib/ai/claude'

const MAX_MESSAGE_LENGTH = 2000
const HISTORY_LIMIT = 20

// Simple in-memory rate limit (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 20 // 20 requests per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(MAX_MESSAGE_LENGTH, `Message must be ${MAX_MESSAGE_LENGTH} characters or less`),
})

export async function POST(request: NextRequest) {
  try {
    const coach = await getOrCreateCoach()

    // Rate limiting
    if (!checkRateLimit(coach.id)) {
      return NextResponse.json(
        { error: 'Rate limited', message: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON', message: 'Request body must be valid JSON' },
        { status: 400 }
      )
    }

    const parsed = chatMessageSchema.safeParse(body)
    if (!parsed.success) {
      const errors = parsed.error.flatten()
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: errors.fieldErrors.message?.[0] || 'Invalid message',
        },
        { status: 400 }
      )
    }

    const { message } = parsed.data

    // Load brand profile
    const [brandProfile] = await db
      .select({
        styleWords: brandProfiles.styleWords,
        tone: brandProfiles.tone,
        emojiUsage: brandProfiles.emojiUsage,
        signOff: brandProfiles.signOff,
        avoidedTopics: brandProfiles.avoidedTopics,
        avoidedWords: brandProfiles.avoidedWords,
        preferredWords: brandProfiles.preferredWords,
        targetAudience: brandProfiles.targetAudience,
        examplePosts: brandProfiles.examplePosts,
      })
      .from(brandProfiles)
      .where(eq(brandProfiles.coachId, coach.id))

    // Load last 20 chat messages for context (ordered ASC for conversation flow)
    const chatHistory = await db
      .select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.coachId, coach.id))
      .orderBy(asc(chatMessages.createdAt))
      .limit(HISTORY_LIMIT)

    const history = chatHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // Transform brand profile to expected format
    const brandProfileForAI: BrandProfile | null = brandProfile ? {
      style_words: brandProfile.styleWords,
      tone: brandProfile.tone,
      emoji_usage: brandProfile.emojiUsage,
      sign_off: brandProfile.signOff,
      avoided_topics: brandProfile.avoidedTopics,
      avoided_words: brandProfile.avoidedWords,
      preferred_words: brandProfile.preferredWords,
      target_audience: brandProfile.targetAudience,
      example_posts: brandProfile.examplePosts,
    } : null

    // Call Claude to generate content
    const result = await generateContent(message, brandProfileForAI, history)

    if (!result.success) {
      // Map AI error codes to HTTP status codes
      const statusMap: Record<string, number> = {
        rate_limit: 429,
        invalid_request: 400,
        api_error: 503,
        unknown: 500,
      }
      return NextResponse.json(
        { error: result.code, message: result.error },
        { status: statusMap[result.code] || 500 }
      )
    }

    // Persist user message
    await db.insert(chatMessages).values({
      coachId: coach.id,
      role: 'user',
      content: message,
    })

    // Persist assistant message
    const [assistantMessage] = await db
      .insert(chatMessages)
      .values({
        coachId: coach.id,
        role: 'assistant',
        content: result.content,
      })
      .returning({ id: chatMessages.id })

    // Detect if response contains postable content and save as draft
    let contentId: string | undefined
    const isPostableContent =
      result.content.length > 100 &&
      !result.content.trim().startsWith('?') &&
      !result.content.toLowerCase().startsWith('what ') &&
      !result.content.toLowerCase().startsWith('how ') &&
      !result.content.toLowerCase().startsWith('would you ')

    if (isPostableContent) {
      const [contentData] = await db
        .insert(content)
        .values({
          coachId: coach.id,
          type: 'instagram_post',
          status: 'draft',
          body: result.content,
        })
        .returning({ id: content.id })

      contentId = contentData?.id

      // Link content to the assistant message
      if (contentId && assistantMessage?.id) {
        await db
          .update(chatMessages)
          .set({ contentId })
          .where(eq(chatMessages.id, assistantMessage.id))
      }
    }

    return NextResponse.json({
      message: result.content,
      contentId,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to process message' },
      { status: 500 }
    )
  }
}
