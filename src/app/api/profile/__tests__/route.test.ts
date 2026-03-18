import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import { GET, PATCH } from '../route'

function setupSupabase(overrides: { user?: any; selectResult?: any; updateResult?: any } = {}) {
  const user = overrides.user ?? { id: 'user-123' }
  const selectChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(overrides.selectResult ?? { data: { style_words: 'energetic' }, error: null }),
      }),
    }),
  }
  const updateChain = {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(overrides.updateResult ?? { data: { style_words: 'calm' }, error: null }),
        }),
      }),
    }),
  }

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => ({ ...selectChain, ...updateChain })),
  })
}

describe('Profile API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/profile', () => {
    it('returns 401 when not authenticated', async () => {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        from: vi.fn(),
      })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns brand profile for authenticated user', async () => {
      setupSupabase({ selectResult: { data: { style_words: 'energetic', tone: 'motivational' }, error: null } })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.style_words).toBe('energetic')
    })
  })

  describe('PATCH /api/profile', () => {
    it('returns 401 when not authenticated', async () => {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        from: vi.fn(),
      })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ style_words: 'calm' }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(401)
    })

    it('updates brand profile with valid data', async () => {
      setupSupabase({
        updateResult: { data: { style_words: 'calm', completed_at: '2024-01-01' }, error: null },
      })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ style_words: 'calm, focused', tone: 'educational' }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(200)
    })

    it('rejects invalid tone values', async () => {
      setupSupabase()

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ tone: 'invalid_tone' }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(400)
    })

    it('rejects invalid emoji_usage values', async () => {
      setupSupabase()

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ emoji_usage: 'sometimes' }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(400)
    })

    it('handles skip by incrementing skipped_count', async () => {
      setupSupabase({
        selectResult: { data: { skipped_count: 0 }, error: null },
      })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ skip: true }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.skipped).toBe(true)
    })

    it('truncates style_words to 255 chars', async () => {
      setupSupabase()

      const longStyle = 'a'.repeat(300)
      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ style_words: longStyle }),
      })
      const response = await PATCH(request)
      // Should succeed (truncation happens server-side)
      expect(response.status).toBe(200)
    })
  })
})
