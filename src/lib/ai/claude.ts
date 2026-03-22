import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY, CLAUDE_MODEL } from '@/lib/env'
import { buildSystemPrompt, type BrandProfileForPrompt } from './prompts'

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
})

// Re-export for backwards compatibility
export type { BrandProfileForPrompt as BrandProfile }

export interface GenerationResult {
  success: true
  content: string
}

// Multi-format content types
export interface MultiFormatContent {
  caption?: string
  carousel?: string
  reel?: string
}

export interface MultiFormatResult {
  formats: MultiFormatContent
  warnings: string[]
  hasContent: boolean
}

export interface GenerationError {
  success: false
  error: string
  code: 'api_error' | 'rate_limit' | 'invalid_request' | 'unknown'
}

export type GenerationResponse = GenerationResult | GenerationError

export async function generateContent(
  userMessage: string,
  brandProfile: BrandProfileForPrompt | null,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<GenerationResponse> {
  const systemPrompt = buildSystemPrompt({ brandProfile })

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

/**
 * Extract content from XML-tagged multi-format response.
 * Expects tags: <caption>...</caption>, <carousel>...</carousel>, <reel>...</reel>
 * Handles partial responses gracefully - returns whatever formats are available.
 */
export function parseMultiFormatResponse(text: string): MultiFormatResult {
  const warnings: string[] = []
  const formats: MultiFormatContent = {}

  // Extract caption
  const captionMatch = text.match(/<caption>([\s\S]*?)<\/caption>/i)
  if (captionMatch) {
    formats.caption = captionMatch[1].trim()
  }

  // Extract carousel
  const carouselMatch = text.match(/<carousel>([\s\S]*?)<\/carousel>/i)
  if (carouselMatch) {
    formats.carousel = carouselMatch[1].trim()
  }

  // Extract reel
  const reelMatch = text.match(/<reel>([\s\S]*?)<\/reel>/i)
  if (reelMatch) {
    formats.reel = reelMatch[1].trim()
  }

  // Check for missing formats and add warnings
  const expectedFormats = ['caption', 'carousel', 'reel'] as const
  const foundFormats = Object.keys(formats) as (keyof MultiFormatContent)[]

  if (foundFormats.length === 0) {
    warnings.push('No valid format tags found in response')
  } else if (foundFormats.length < expectedFormats.length) {
    const missing = expectedFormats.filter((f) => !formats[f])
    warnings.push(`Missing formats: ${missing.join(', ')}`)
  }

  // Check for empty content within tags
  for (const format of foundFormats) {
    if (!formats[format] || formats[format]!.length === 0) {
      warnings.push(`Empty content in <${format}> tag`)
      delete formats[format]
    }
  }

  return {
    formats,
    warnings,
    hasContent: Object.keys(formats).length > 0,
  }
}

/**
 * Convert multi-format content to JSON string for storage in content.body
 */
export function serializeMultiFormat(content: MultiFormatContent): string {
  return JSON.stringify(content)
}

/**
 * Parse stored multi-format content from content.body JSON
 * Falls back to treating the entire body as caption for backwards compatibility
 */
export function deserializeMultiFormat(body: string): MultiFormatContent {
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as MultiFormatContent
    }
  } catch {
    // Not JSON - treat as plain caption for backwards compatibility
  }
  return { caption: body }
}
