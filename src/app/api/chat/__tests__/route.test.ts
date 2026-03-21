import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCreateClient, mockGenerateContent } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGenerateContent: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/ai/claude', () => ({
  generateContent: mockGenerateContent,
}))

import { POST } from '../route'

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupSupabase(overrides: {
  user?: { id: string; email: string } | null
  brandProfile?: Record<string, unknown> | null
  chatHistory?: { role: string; content: string }[]
} = {}) {
  const user = overrides.user === undefined ? { id: 'user-123', email: 'test@test.com' } : overrides.user

  const selectBrandProfile = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: overrides.brandProfile ?? { style_words: 'energetic' },
        error: null,
      }),
    }),
  })

  const selectChatHistory = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: overrides.chatHistory ?? [],
          error: null,
        }),
      }),
    }),
  })

  const insertResult = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'msg-123' }, error: null }),
    }),
  })

  const updateResult = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  })

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'brand_profiles') {
        return { select: selectBrandProfile }
      }
      if (table === 'chat_messages') {
        return { select: selectChatHistory, insert: insertResult, update: updateResult }
      }
      if (table === 'content') {
        return { insert: insertResult }
      }
      return {}
    }),
  })
}

describe('Chat API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockResolvedValue({
      success: true,
      content: 'Here is your generated content for Instagram!',
    })
  })

  describe('POST /api/chat', () => {
    it('returns 401 when not authenticated', async () => {
      setupSupabase({ user: null })

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 400 for missing message', async () => {
      setupSupabase()

      const request = createRequest({})
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Validation failed')
    })

    it('returns 400 for empty message', async () => {
      setupSupabase()

      const request = createRequest({ message: '' })
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('returns 400 for oversized message', async () => {
      setupSupabase()

      const longMessage = 'a'.repeat(2001)
      const request = createRequest({ message: longMessage })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.message).toContain('2000 characters')
    })

    it('returns 400 for invalid JSON', async () => {
      setupSupabase()

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid JSON')
    })

    it('calls generateContent with message and brand profile', async () => {
      setupSupabase({ brandProfile: { style_words: 'energetic', tone: 'motivational' } })

      const request = createRequest({ message: 'Write a post about morning routines' })
      await POST(request)

      expect(mockGenerateContent).toHaveBeenCalledWith(
        'Write a post about morning routines',
        expect.objectContaining({ style_words: 'energetic' }),
        expect.any(Array)
      )
    })

    it('returns generated content', async () => {
      setupSupabase()
      mockGenerateContent.mockResolvedValue({
        success: true,
        content: 'Here is your motivational post!',
      })

      const request = createRequest({ message: 'Write something' })
      const response = await POST(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.message).toBe('Here is your motivational post!')
    })

    it('handles AI rate limit errors', async () => {
      setupSupabase()
      mockGenerateContent.mockResolvedValue({
        success: false,
        error: 'Rate limited',
        code: 'rate_limit',
      })

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request)

      expect(response.status).toBe(429)
    })

    it('handles AI API errors', async () => {
      setupSupabase()
      mockGenerateContent.mockResolvedValue({
        success: false,
        error: 'Service unavailable',
        code: 'api_error',
      })

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request)

      expect(response.status).toBe(503)
    })

    it('returns contentId for long generated content', async () => {
      setupSupabase()
      mockGenerateContent.mockResolvedValue({
        success: true,
        content: 'A'.repeat(150) + ' - this is a long post that should be saved as a draft',
      })

      const request = createRequest({ message: 'Write a post' })
      const response = await POST(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.contentId).toBe('msg-123')
    })

    it('does not create content for short responses', async () => {
      setupSupabase()
      mockGenerateContent.mockResolvedValue({
        success: true,
        content: 'Sure!',
      })

      const request = createRequest({ message: 'Can you help?' })
      const response = await POST(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.contentId).toBeUndefined()
    })

    it('does not create content for question responses', async () => {
      setupSupabase()
      mockGenerateContent.mockResolvedValue({
        success: true,
        content: 'What kind of content would you like me to create? I can help with captions, stories, or reels. ' + 'A'.repeat(100),
      })

      const request = createRequest({ message: 'Help me' })
      const response = await POST(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.contentId).toBeUndefined()
    })

    it('passes chat history to generateContent', async () => {
      setupSupabase({
        chatHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      })

      const request = createRequest({ message: 'Continue' })
      await POST(request)

      expect(mockGenerateContent).toHaveBeenCalledWith(
        'Continue',
        expect.anything(),
        [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ]
      )
    })
  })
})
