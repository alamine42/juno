import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import { GET, PATCH, DELETE } from '../route'

const mockParams = { params: Promise.resolve({ id: 'content-123' }) }

function createRequest(method: string, body?: unknown): NextRequest {
  const init: RequestInit = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest('http://localhost:3000/api/content/content-123', init)
}

function setupSupabase(overrides: {
  user?: { id: string } | null
  content?: unknown | null
  fetchError?: unknown
  updateResult?: { data: unknown; error: unknown }
  deleteError?: unknown
} = {}) {
  const user = overrides.user === undefined ? { id: 'user-123' } : overrides.user

  const selectSingle = vi.fn().mockResolvedValue({
    data: overrides.content ?? { id: 'content-123', body: 'Test', status: 'draft' },
    error: overrides.fetchError ?? null,
  })

  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(
        overrides.updateResult ?? { data: { id: 'content-123', body: 'Updated' }, error: null }
      ),
    }),
  }

  const deleteChain = {
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: overrides.deleteError ?? null }),
    }),
  }

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: selectSingle,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue(updateChain),
      delete: vi.fn().mockReturnValue(deleteChain),
    })),
  })
}

describe('Content [id] API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/content/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      setupSupabase({ user: null })

      const response = await GET(createRequest('GET'), mockParams)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns content item', async () => {
      const mockContent = { id: 'content-123', body: 'Test post', status: 'draft' }
      setupSupabase({ content: mockContent })

      const response = await GET(createRequest('GET'), mockParams)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe('content-123')
    })

    it('returns 404 when content not found (PGRST116)', async () => {
      setupSupabase({ content: null, fetchError: { code: 'PGRST116' } })

      const response = await GET(createRequest('GET'), mockParams)

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe('Not found')
    })

    it('returns 500 on database error', async () => {
      setupSupabase({ fetchError: { code: 'OTHER_ERROR', message: 'DB error' } })

      const response = await GET(createRequest('GET'), mockParams)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Server error')
    })
  })

  describe('PATCH /api/content/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      setupSupabase({ user: null })

      const response = await PATCH(createRequest('PATCH', { body: 'Updated' }), mockParams)

      expect(response.status).toBe(401)
    })

    it('returns 404 when content not found', async () => {
      setupSupabase({ content: null, fetchError: { code: 'PGRST116' } })

      const response = await PATCH(createRequest('PATCH', { body: 'Updated' }), mockParams)

      expect(response.status).toBe(404)
    })

    it('returns 400 for empty patch body', async () => {
      setupSupabase()

      const response = await PATCH(createRequest('PATCH', {}), mockParams)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Validation failed')
    })

    it('returns 400 for invalid JSON', async () => {
      setupSupabase()

      const request = new NextRequest('http://localhost:3000/api/content/123', {
        method: 'PATCH',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await PATCH(request, mockParams)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid JSON')
    })

    it('returns 400 for invalid status', async () => {
      setupSupabase()

      const response = await PATCH(createRequest('PATCH', { status: 'invalid' }), mockParams)

      expect(response.status).toBe(400)
    })

    it('updates body successfully', async () => {
      setupSupabase({
        updateResult: {
          data: { id: 'content-123', body: 'Updated content that is long enough' },
          error: null,
        },
      })

      const response = await PATCH(
        createRequest('PATCH', { body: 'Updated content that is long enough' }),
        mockParams
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.body).toBe('Updated content that is long enough')
    })

    it('updates status successfully', async () => {
      setupSupabase({
        updateResult: {
          data: { id: 'content-123', status: 'posted' },
          error: null,
        },
      })

      const response = await PATCH(createRequest('PATCH', { status: 'posted' }), mockParams)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('posted')
    })

    it('updates reminder_at successfully', async () => {
      setupSupabase({
        updateResult: {
          data: { id: 'content-123', reminder_at: '2024-12-01T10:00:00Z' },
          error: null,
        },
      })

      const response = await PATCH(
        createRequest('PATCH', { reminder_at: '2024-12-01T10:00:00Z' }),
        mockParams
      )

      expect(response.status).toBe(200)
    })

    it('returns 422 for red-rated body update', async () => {
      setupSupabase()

      const response = await PATCH(
        createRequest('PATCH', { body: 'This cure will provide guaranteed weight loss!' }),
        mockParams
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe('Content blocked')
    })

    it('returns moderation result when body is updated', async () => {
      const testBody =
        'Updated content that passes moderation easily because it is long enough to meet the minimum character requirement.'
      setupSupabase({
        updateResult: {
          data: { id: 'content-123', body: testBody },
          error: null,
        },
      })

      const response = await PATCH(createRequest('PATCH', { body: testBody }), mockParams)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.moderation).toBeDefined()
      expect(body.moderation.rating).toBe('green')
    })

    it('does not return moderation when only status is updated', async () => {
      setupSupabase({
        updateResult: {
          data: { id: 'content-123', status: 'posted' },
          error: null,
        },
      })

      const response = await PATCH(createRequest('PATCH', { status: 'posted' }), mockParams)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.moderation).toBeUndefined()
    })

    it('rejects extra fields with strict validation', async () => {
      setupSupabase()

      const response = await PATCH(
        createRequest('PATCH', { body: 'Test', extraField: 'not allowed' }),
        mockParams
      )

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/content/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      setupSupabase({ user: null })

      const response = await DELETE(createRequest('DELETE'), mockParams)

      expect(response.status).toBe(401)
    })

    it('returns 404 when content not found', async () => {
      setupSupabase({ content: null, fetchError: { code: 'PGRST116' } })

      const response = await DELETE(createRequest('DELETE'), mockParams)

      expect(response.status).toBe(404)
    })

    it('deletes content successfully', async () => {
      setupSupabase()

      const response = await DELETE(createRequest('DELETE'), mockParams)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.deleted).toBe(true)
    })

    it('returns 500 on delete error', async () => {
      setupSupabase({ deleteError: { message: 'Delete failed' } })

      const response = await DELETE(createRequest('DELETE'), mockParams)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Server error')
    })
  })
})
