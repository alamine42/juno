import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
  RATE_LIMIT_PRESETS: { content: { maxRequests: 30, windowMs: 60000 } },
}))

import { GET, POST } from '../route'

function createGetRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/content${query}`)
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/content', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupSupabase(overrides: {
  user?: { id: string } | null
  contentList?: unknown[]
  insertResult?: { data: unknown; error: unknown }
  selectError?: unknown
} = {}) {
  const user = overrides.user === undefined ? { id: 'user-123' } : overrides.user

  const selectChain: Record<string, ReturnType<typeof vi.fn>> = {}
  selectChain.eq = vi.fn().mockReturnValue(selectChain)
  selectChain.order = vi.fn().mockReturnValue(selectChain)
  selectChain.limit = vi.fn().mockReturnValue(selectChain)
  selectChain.then = vi.fn((resolve: (value: unknown) => void) =>
    resolve({
      data: overrides.contentList ?? [],
      error: overrides.selectError ?? null,
    })
  )

  const insertChain = {
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(
        overrides.insertResult ?? { data: { id: 'content-123' }, error: null }
      ),
    }),
  }

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue(insertChain),
    })),
  })
}

describe('Content API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/content', () => {
    it('returns 401 when not authenticated', async () => {
      setupSupabase({ user: null })

      const response = await GET(createGetRequest())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns content list', async () => {
      const mockContent = [
        { id: '1', body: 'Post 1', status: 'draft' },
        { id: '2', body: 'Post 2', status: 'posted' },
      ]
      setupSupabase({ contentList: mockContent })

      const response = await GET(createGetRequest())

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual(mockContent)
    })

    it('returns empty array when no content', async () => {
      setupSupabase({ contentList: [] })

      const response = await GET(createGetRequest())

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual([])
    })

    it('returns 400 for invalid status filter', async () => {
      setupSupabase()

      const response = await GET(createGetRequest('?status=invalid'))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid status')
    })

    it('accepts valid status filters', async () => {
      setupSupabase({ contentList: [] })

      const draftResponse = await GET(createGetRequest('?status=draft'))
      expect(draftResponse.status).toBe(200)

      const reminderResponse = await GET(createGetRequest('?status=reminder_set'))
      expect(reminderResponse.status).toBe(200)

      const postedResponse = await GET(createGetRequest('?status=posted'))
      expect(postedResponse.status).toBe(200)
    })

    it('returns 500 on database error', async () => {
      setupSupabase({ selectError: { message: 'DB error' } })

      const response = await GET(createGetRequest())

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Server error')
    })
  })

  describe('POST /api/content', () => {
    it('returns 401 when not authenticated', async () => {
      setupSupabase({ user: null })

      const response = await POST(createPostRequest({ type: 'caption', body: 'Test post' }))

      expect(response.status).toBe(401)
    })

    it('returns 400 for missing type', async () => {
      setupSupabase()

      const response = await POST(createPostRequest({ body: 'Test post' }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Validation failed')
    })

    it('returns 400 for invalid type', async () => {
      setupSupabase()

      const response = await POST(createPostRequest({ type: 'invalid', body: 'Test' }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for missing body', async () => {
      setupSupabase()

      const response = await POST(createPostRequest({ type: 'caption' }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for empty body', async () => {
      setupSupabase()

      const response = await POST(createPostRequest({ type: 'caption', body: '' }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for body exceeding 3000 chars', async () => {
      setupSupabase()

      const response = await POST(createPostRequest({ type: 'caption', body: 'A'.repeat(3001) }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.message).toContain('3000')
    })

    it('returns 400 for invalid JSON', async () => {
      setupSupabase()

      const request = new NextRequest('http://localhost:3000/api/content', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid JSON')
    })

    it('creates content and returns 201', async () => {
      setupSupabase({
        insertResult: {
          data: { id: 'new-content', type: 'caption', body: 'Test post', status: 'draft' },
          error: null,
        },
      })

      const response = await POST(createPostRequest({
        type: 'caption',
        body: 'This is a test post that is long enough to pass moderation checks easily.',
      }))

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.id).toBe('new-content')
      expect(body.moderation).toBeDefined()
      expect(body.moderation.rating).toBe('green')
    })

    it('returns 422 for red-rated content', async () => {
      setupSupabase()

      const response = await POST(createPostRequest({
        type: 'caption',
        body: 'This product will cure all your problems and provide guaranteed weight loss!',
      }))

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe('Content blocked')
      expect(body.moderation.rating).toBe('red')
    })

    it('allows yellow-rated content', async () => {
      setupSupabase({
        insertResult: {
          data: { id: 'yellow-content', status: 'draft' },
          error: null,
        },
      })

      const response = await POST(createPostRequest({
        type: 'caption',
        body: 'Short post', // Too short = yellow
      }))

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.moderation.rating).toBe('yellow')
    })

    it('accepts carousel_script type', async () => {
      setupSupabase({
        insertResult: {
          data: { id: 'carousel-content', type: 'carousel_script' },
          error: null,
        },
      })

      const response = await POST(createPostRequest({
        type: 'carousel_script',
        body: 'Slide 1: Introduction. Slide 2: Key point. Slide 3: Conclusion. This is carousel content.',
      }))

      expect(response.status).toBe(201)
    })

    it('accepts optional framework_id', async () => {
      setupSupabase({
        insertResult: {
          data: { id: 'framework-content', framework_id: 'client_win' },
          error: null,
        },
      })

      const response = await POST(createPostRequest({
        type: 'caption',
        body: 'Framework-based content that is long enough for the moderation check.',
        framework_id: 'client_win',
      }))

      expect(response.status).toBe(201)
    })

    it('accepts optional framework_answers', async () => {
      setupSupabase({
        insertResult: {
          data: { id: 'answers-content', framework_answers: { key: 'value' } },
          error: null,
        },
      })

      const response = await POST(createPostRequest({
        type: 'caption',
        body: 'Content with framework answers that passes the length requirement.',
        framework_answers: { client_name: 'Sarah', achievement: 'Lost weight' },
      }))

      expect(response.status).toBe(201)
    })
  })
})
