import Anthropic from '@anthropic-ai/sdk'

// Use environment variable for model, with fallback to a known good model
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface BrandProfile {
  style_words: string | null
  tone: string | null
  emoji_usage: string | null
  sign_off: string | null
  avoided_topics: string[] | null
  avoided_words: string[] | null
  preferred_words: string[] | null
  target_audience: string | null
  example_posts: string[] | null
}

export interface GenerationResult {
  success: true
  content: string
}

export interface GenerationError {
  success: false
  error: string
  code: 'api_error' | 'rate_limit' | 'invalid_request' | 'unknown'
}

export type GenerationResponse = GenerationResult | GenerationError

export function buildSystemPrompt(brandProfile: BrandProfile | null): string {
  const basePrompt = `You are Juno, an AI assistant for fitness and wellness coaches.
You help create Instagram content that sounds authentic to the coach's voice.
You are encouraging, professional, and focused on helping coaches succeed.`

  if (!brandProfile) {
    return `${basePrompt}

The coach hasn't set up their brand profile yet. Use a friendly, professional tone.
Ask clarifying questions about their style if the request is ambiguous.`
  }

  const parts = [basePrompt, '\n\n## This Coach\'s Brand Voice\n']

  if (brandProfile.style_words) {
    parts.push(`**Style:** ${brandProfile.style_words}`)
  }
  if (brandProfile.tone) {
    parts.push(`**Tone:** ${brandProfile.tone}`)
  }
  if (brandProfile.emoji_usage) {
    parts.push(`**Emoji usage:** ${brandProfile.emoji_usage}`)
  }
  if (brandProfile.sign_off) {
    parts.push(`**Typical sign-off:** ${brandProfile.sign_off}`)
  }
  if (brandProfile.target_audience) {
    parts.push(`**Target audience:** ${brandProfile.target_audience}`)
  }
  if (brandProfile.preferred_words?.length) {
    parts.push(`**Words/phrases they love:** ${brandProfile.preferred_words.join(', ')}`)
  }
  if (brandProfile.avoided_words?.length) {
    parts.push(`**Words/phrases to AVOID:** ${brandProfile.avoided_words.join(', ')}`)
  }
  if (brandProfile.avoided_topics?.length) {
    parts.push(`**Topics to NEVER mention:** ${brandProfile.avoided_topics.join(', ')}`)
  }
  if (brandProfile.example_posts?.length) {
    parts.push(`\n**Examples of their writing style:**`)
    brandProfile.example_posts.forEach((post, i) => {
      const truncated = post.length > 500 ? post.slice(0, 500) + '...' : post
      parts.push(`${i + 1}. "${truncated}"`)
    })
  }

  parts.push('\nMatch this voice exactly. Don\'t be generic—sound like THIS coach.')

  return parts.join('\n')
}

export async function generateContent(
  userMessage: string,
  brandProfile: BrandProfile | null,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<GenerationResponse> {
  const systemPrompt = buildSystemPrompt(brandProfile)

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: userMessage },
  ]

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    const content = textBlock?.type === 'text' ? textBlock.text : ''

    return { success: true, content }
  } catch (err) {
    // Log error without leaking the prompt
    const error = err as Error & { status?: number; code?: string }
    console.error('Claude API error:', {
      message: error.message,
      status: error.status,
      code: error.code,
    })

    // Categorize the error
    if (error.status === 429) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please try again in a moment.',
        code: 'rate_limit',
      }
    }

    if (error.status === 400) {
      return {
        success: false,
        error: 'Invalid request. Please try rephrasing your message.',
        code: 'invalid_request',
      }
    }

    if (error.status && error.status >= 500) {
      return {
        success: false,
        error: 'AI service is temporarily unavailable. Please try again.',
        code: 'api_error',
      }
    }

    return {
      success: false,
      error: 'Failed to generate content. Please try again.',
      code: 'unknown',
    }
  }
}
