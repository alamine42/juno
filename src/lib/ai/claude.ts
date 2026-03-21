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
