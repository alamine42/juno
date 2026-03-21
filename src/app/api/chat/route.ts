import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  // Rate limiting
  if (!checkRateLimit(user.id)) {
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

  try {
    // Load brand profile
    const { data: brandProfile } = await supabase
      .from('brand_profiles')
      .select('style_words, tone, emoji_usage, sign_off, avoided_topics, avoided_words, preferred_words, target_audience, example_posts')
      .eq('coach_id', user.id)
      .single()

    // Load last 20 chat messages for context (ordered ASC for conversation flow)
    const { data: chatHistory } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: true })
      .limit(HISTORY_LIMIT)

    const history = chatHistory?.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })) ?? []

    // Call Claude to generate content
    const result = await generateContent(
      message,
      brandProfile as BrandProfile | null,
      history
    )

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
    await supabase.from('chat_messages').insert({
      coach_id: user.id,
      role: 'user',
      content: message,
    })

    // Persist assistant message
    const { data: assistantMessage } = await supabase
      .from('chat_messages')
      .insert({
        coach_id: user.id,
        role: 'assistant',
        content: result.content,
      })
      .select('id')
      .single()

    // Detect if response contains postable content and save as draft
    // Simple heuristic: if the response is longer than 100 chars and doesn't start with a question
    let contentId: string | undefined
    const isPostableContent =
      result.content.length > 100 &&
      !result.content.trim().startsWith('?') &&
      !result.content.toLowerCase().startsWith('what ') &&
      !result.content.toLowerCase().startsWith('how ') &&
      !result.content.toLowerCase().startsWith('would you ')

    if (isPostableContent) {
      const { data: content } = await supabase
        .from('content')
        .insert({
          coach_id: user.id,
          type: 'instagram_post',
          status: 'draft',
          body: result.content,
        })
        .select('id')
        .single()

      contentId = content?.id

      // Link content to the assistant message
      if (contentId && assistantMessage?.id) {
        await supabase
          .from('chat_messages')
          .update({ content_id: contentId })
          .eq('id', assistantMessage.id)
      }
    }

    return NextResponse.json({
      message: result.content,
      contentId,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to process message' },
      { status: 500 }
    )
  }
}
