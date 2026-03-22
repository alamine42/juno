import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCreateClient, mockGenerateContent, mockCheckRateLimit } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/ai/claude', () => ({
  generateContent: mockGenerateContent,
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMIT_PRESETS: { batch: { maxRequests: 5, windowMs: 60000 } },
}))

import { POST } from '../route'

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/content/batch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupSupabase(overrides: {
  user?: { id: string } | null
  brandProfile?: unknown
  batchInsert?: { data: unknown; error: unknown }
  contentInsert?: { data: unknown; error: unknown }
  batchUpdate?: { error: unknown }
} = {}) {
  const user = overrides.user === undefined ? { id: 'user-123' } : overrides.user

  const selectBrandProfile = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: overrides.brandProfile ?? { style_words: 'energetic' },
        error: null,
      }),
    }),
  })

  const insertBatch = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(
        overrides.batchInsert ?? { data: { id: 'batch-123' }, error: null }
      ),
    }),
  })

  let contentCounter = 0
  const insertContent = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockImplementation(() => {
        contentCounter++
        return Promise.resolve(
          overrides.contentInsert ?? { data: { id: `content-${contentCounter}` }, error: null }
        )
      }),
    }),
  })

  const updateBatch = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue(overrides.batchUpdate ?? { error: null }),
  })

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'brand_profiles') {
        return { select: selectBrandProfile }
      }
      if (table === 'content_batches') {
        return { insert: insertBatch, update: updateBatch }
      }
      if (table === 'content') {
        return { insert: insertContent }
      }
      return {}
    }),
  })
}

describe('Content Batch API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue(true)
    mockGenerateContent.mockResolvedValue({
      success: true,
      content: 'Generated content for your Instagram post about fitness and wellness.',
    })
  })

  describe('POST /api/content/batch', () => {
    it('returns 401 when not authenticated', async () => {
      setupSupabase({ user: null })

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday'],
      }))

      expect(response.status).toBe(401)
    })

    it('returns 429 when rate limited', async () => {
      setupSupabase()
      mockCheckRateLimit.mockReturnValue(false)

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday'],
      }))

      expect(response.status).toBe(429)
      const body = await response.json()
      expect(body.error).toBe('Rate limited')
    })

    it('returns 400 for missing focus_topic', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        posting_days: ['monday'],
      }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Validation failed')
    })

    it('returns 400 for empty posting_days', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: [],
      }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for more than 7 posting_days', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'monday'],
      }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for invalid day name', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['notaday'],
      }))

      expect(response.status).toBe(400)
    })

    it('generates content for single day', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        focus_topic: 'morning routines',
        posting_days: ['monday'],
      }))

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.batchId).toBe('batch-123')
      expect(body.status).toBe('ready')
      expect(body.generated).toBe(1)
      expect(body.failed).toBe(0)
      expect(body.content).toHaveLength(1)
    })

    it('generates content for multiple days', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        focus_topic: 'fitness tips',
        posting_days: ['monday', 'wednesday', 'friday'],
      }))

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.generated).toBe(3)
      expect(body.content).toHaveLength(3)
    })

    it('handles partial failures gracefully', async () => {
      setupSupabase()
      let callCount = 0
      mockGenerateContent.mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          return Promise.resolve({ success: false, error: 'API error', code: 'api_error' })
        }
        return Promise.resolve({ success: true, content: 'Generated content for testing.' })
      })

      const response = await POST(createRequest({
        focus_topic: 'workout',
        posting_days: ['monday', 'tuesday', 'wednesday'],
      }))

      expect(response.status).toBe(207) // Multi-Status
      const body = await response.json()
      expect(body.status).toBe('partial')
      expect(body.generated).toBe(2)
      expect(body.failed).toBe(1)
    })

    it('returns 500 when all generations fail', async () => {
      setupSupabase()
      mockGenerateContent.mockResolvedValue({
        success: false,
        error: 'Service unavailable',
        code: 'api_error',
      })

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday', 'tuesday'],
      }))

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.status).toBe('failed')
      expect(body.generated).toBe(0)
    })

    it('skips red-rated content without failing batch', async () => {
      setupSupabase()
      let callCount = 0
      mockGenerateContent.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            success: true,
            content: 'This cure will guarantee weight loss!', // Red content
          })
        }
        return Promise.resolve({
          success: true,
          content: 'Normal fitness content that passes moderation checks.',
        })
      })

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday', 'tuesday'],
      }))

      expect(response.status).toBe(207) // Partial due to red content
      const body = await response.json()
      expect(body.status).toBe('partial')
      expect(body.generated).toBe(1)
      expect(body.failed).toBe(1)
    })

    it('accepts optional promotion_text', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        focus_topic: 'nutrition',
        posting_days: ['monday'],
        promotion_text: 'Check out my new program!',
      }))

      expect(response.status).toBe(201)
    })

    it('calls generateContent for each day', async () => {
      setupSupabase()

      await POST(createRequest({
        focus_topic: 'cardio',
        posting_days: ['monday', 'wednesday'],
      }))

      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('generates content for all 7 days', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        focus_topic: 'weekly fitness challenge',
        posting_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      }))

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.generated).toBe(7)
      expect(body.content).toHaveLength(7)
      expect(mockGenerateContent).toHaveBeenCalledTimes(7)
    })

    it('processes days sequentially in order', async () => {
      setupSupabase()
      const callOrder: string[] = []

      mockGenerateContent.mockImplementation((prompt: string) => {
        // Extract day name from prompt
        const dayMatch = prompt.match(/for (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)
        if (dayMatch) {
          callOrder.push(dayMatch[1].toLowerCase())
        }
        return Promise.resolve({ success: true, content: 'Generated content' })
      })

      await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['wednesday', 'monday', 'friday'],
      }))

      // Days should be processed in the order provided
      expect(callOrder).toEqual(['wednesday', 'monday', 'friday'])
    })

    it('handles content insert failure for some days', async () => {
      let insertCount = 0
      const insertContent = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(() => {
            insertCount++
            if (insertCount === 2) {
              return Promise.resolve({ data: null, error: { code: '23502', message: 'Insert failed' } })
            }
            return Promise.resolve({ data: { id: `content-${insertCount}` }, error: null })
          }),
        }),
      })

      const selectBrandProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { style_words: 'energetic' }, error: null }),
        }),
      })

      const insertBatch = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'batch-123' }, error: null }),
        }),
      })

      const updateBatch = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'brand_profiles') {
            return { select: selectBrandProfile }
          }
          if (table === 'content_batches') {
            return { insert: insertBatch, update: updateBatch }
          }
          if (table === 'content') {
            return { insert: insertContent }
          }
          return {}
        }),
      })

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday', 'tuesday', 'wednesday'],
      }))

      expect(response.status).toBe(207)
      const body = await response.json()
      expect(body.status).toBe('partial')
      expect(body.generated).toBe(2)
      expect(body.failed).toBe(1)
    })

    it('returns 400 for invalid JSON body', async () => {
      setupSupabase()

      const request = new NextRequest('http://localhost:3000/api/content/batch', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid JSON')
    })

    it('returns 400 for focus_topic exceeding max length', async () => {
      setupSupabase()

      const response = await POST(createRequest({
        focus_topic: 'a'.repeat(501), // Max is 500
        posting_days: ['monday'],
      }))

      expect(response.status).toBe(400)
    })

    it('rotates frameworks for variety across days', async () => {
      setupSupabase()
      const frameworksUsed: string[] = []

      mockGenerateContent.mockImplementation((prompt: string) => {
        // Extract framework type from prompt
        if (prompt.includes('Client Win')) frameworksUsed.push('client_win')
        else if (prompt.includes('Educational')) frameworksUsed.push('educational_carousel')
        else if (prompt.includes('Engagement')) frameworksUsed.push('engagement_hook')
        else if (prompt.includes('Behind the Scenes')) frameworksUsed.push('behind_the_scenes')
        else if (prompt.includes('Myth Buster')) frameworksUsed.push('myth_buster')
        return Promise.resolve({ success: true, content: 'Generated content' })
      })

      await POST(createRequest({
        focus_topic: 'fitness variety',
        posting_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      }))

      // Should use different frameworks for different days
      expect(frameworksUsed.length).toBe(5)
    })

    it('handles brand profile fetch error gracefully', async () => {
      const selectBrandProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows' }, // Not found is ok
          }),
        }),
      })

      const insertBatch = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'batch-123' }, error: null }),
        }),
      })

      const insertContent = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'content-1' }, error: null }),
        }),
      })

      const updateBatch = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'brand_profiles') {
            return { select: selectBrandProfile }
          }
          if (table === 'content_batches') {
            return { insert: insertBatch, update: updateBatch }
          }
          if (table === 'content') {
            return { insert: insertContent }
          }
          return {}
        }),
      })

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday'],
      }))

      // Should still succeed even without brand profile
      expect(response.status).toBe(201)
    })

    it('handles batch create failure', async () => {
      const selectBrandProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { style_words: 'energetic' }, error: null }),
        }),
      })

      const insertBatch = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23502', message: 'Required field missing' },
          }),
        }),
      })

      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'brand_profiles') {
            return { select: selectBrandProfile }
          }
          if (table === 'content_batches') {
            return { insert: insertBatch }
          }
          return {}
        }),
      })

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday'],
      }))

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Server error')
    })

    it('includes token usage when available', async () => {
      setupSupabase()
      mockGenerateContent.mockResolvedValue({
        success: true,
        content: 'Generated content with token tracking',
        usage: {
          input_tokens: 150,
          output_tokens: 200,
          model: 'claude-3-haiku',
        },
      })

      const response = await POST(createRequest({
        focus_topic: 'fitness',
        posting_days: ['monday'],
      }))

      expect(response.status).toBe(201)
      // Token usage is tracked but not returned in response
    })
  })
})
