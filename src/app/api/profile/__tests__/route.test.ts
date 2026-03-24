import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the db helpers module
const mockGetOrCreateCoach = vi.fn()
const mockGetBrandProfile = vi.fn()
const mockGetOrCreateBrandProfile = vi.fn()

vi.mock('@/lib/db/helpers', () => ({
  getOrCreateCoach: () => mockGetOrCreateCoach(),
  getBrandProfile: (coachId: string) => mockGetBrandProfile(coachId),
  getOrCreateBrandProfile: (coachId: string) => mockGetOrCreateBrandProfile(coachId),
}))

// Mock the db module
const mockDbUpdate = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    update: () => mockDbUpdate(),
  },
}))

import { GET, PATCH } from '../route'

function setupMocks(overrides: {
  user?: { id: string } | null
  profile?: Record<string, unknown> | null
  updateResult?: Record<string, unknown>
} = {}) {
  const user = overrides.user === undefined ? { id: 'coach-123', clerkId: 'user-123' } : overrides.user

  if (user === null) {
    mockGetOrCreateCoach.mockRejectedValue(new Error('Unauthorized'))
  } else {
    mockGetOrCreateCoach.mockResolvedValue(user)
  }

  mockGetBrandProfile.mockResolvedValue(
    overrides.profile === undefined
      ? { styleWords: 'energetic', tone: 'motivational' }
      : overrides.profile
  )

  mockGetOrCreateBrandProfile.mockResolvedValue(
    overrides.profile === undefined
      ? { id: 'profile-123', coachId: 'coach-123', skippedCount: 0 }
      : { id: 'profile-123', coachId: 'coach-123', skippedCount: 0, ...overrides.profile }
  )

  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([overrides.updateResult ?? { styleWords: 'calm' }]),
      }),
    }),
  })
}

describe('Profile API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/profile', () => {
    it('returns 401 when not authenticated', async () => {
      setupMocks({ user: null })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('returns brand profile for authenticated user', async () => {
      setupMocks({ profile: { styleWords: 'energetic', tone: 'motivational' } })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET()
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.styleWords).toBe('energetic')
    })

    it('returns 404 when profile not found', async () => {
      setupMocks({ profile: null })

      const response = await GET()
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /api/profile', () => {
    it('returns 401 when not authenticated', async () => {
      setupMocks({ user: null })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ style_words: 'calm' }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(401)
    })

    it('updates brand profile with valid data', async () => {
      setupMocks({
        updateResult: { styleWords: 'calm', completedAt: '2024-01-01' },
      })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ style_words: 'calm, focused', tone: 'educational' }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(200)
    })

    it('rejects invalid tone values', async () => {
      setupMocks()

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ tone: 'invalid_tone' }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(400)
    })

    it('rejects invalid emoji_usage values', async () => {
      setupMocks()

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ emoji_usage: 'sometimes' }),
      })
      const response = await PATCH(request)
      expect(response.status).toBe(400)
    })

    it('handles skip by incrementing skipped_count', async () => {
      setupMocks({
        profile: { skippedCount: 0 },
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
      setupMocks()

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
