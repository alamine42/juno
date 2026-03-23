import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Hoisted mocks
const { mockHeaders, mockServiceClient, mockSendReminder, mockModerate } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockServiceClient: vi.fn(),
  mockSendReminder: vi.fn(),
  mockModerate: vi.fn(),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

// Mock service client
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mockServiceClient,
}))

// Mock email
vi.mock('@/lib/email/resend', () => ({
  sendPostingReminder: mockSendReminder,
}))

// Mock moderation
vi.mock('@/lib/moderation', () => ({
  moderateContent: mockModerate,
}))

import { GET, POST } from '../route'

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/reminders')
}

function setupValidCronHeaders() {
  mockHeaders.mockResolvedValue({
    get: (name: string) => {
      if (name === 'user-agent') return 'vercel-cron/1.0'
      if (name === 'authorization') return 'Bearer test-cron-secret'
      return null
    },
  })
}

function setupSupabaseMocks(overrides: {
  contentItems?: Array<{
    id: string
    body: string
    coach_id: string
    coaches: { email: string; name: string | null }
  }>
  queryError?: Error | null
  updateError?: Error | null
  healthUpsertError?: Error | null
} = {}) {
  const contentItems = overrides.contentItems ?? []

  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve: (value: unknown) => void) =>
      resolve({
        data: contentItems,
        error: overrides.queryError ?? null,
      })
    ),
  }

  const updateChain = {
    eq: vi.fn().mockResolvedValue({
      data: null,
      error: overrides.updateError ?? null,
    }),
  }

  const upsertChain = vi.fn().mockResolvedValue({
    data: null,
    error: overrides.healthUpsertError ?? null,
  })

  mockServiceClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'content') {
        return {
          select: vi.fn().mockReturnValue(selectChain),
          update: vi.fn().mockReturnValue(updateChain),
        }
      }
      if (table === 'system_health') {
        return {
          upsert: upsertChain,
        }
      }
      return {}
    }),
  })
}

describe('Cron Reminders API Route', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.CRON_SECRET = 'test-cron-secret'
    process.env.NODE_ENV = 'production'
    mockModerate.mockReturnValue({ rating: 'green', reasons: [] })
    mockSendReminder.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Authentication', () => {
    it('returns 401 without CRON_SECRET configured', async () => {
      delete process.env.CRON_SECRET
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === 'user-agent') return 'vercel-cron/1.0'
          if (name === 'authorization') return 'Bearer test-cron-secret'
          return null
        },
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 401 without Vercel user-agent', async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === 'user-agent') return 'Mozilla/5.0'
          if (name === 'authorization') return 'Bearer test-cron-secret'
          return null
        },
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 401 without authorization header', async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === 'user-agent') return 'vercel-cron/1.0'
          if (name === 'authorization') return null
          return null
        },
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(401)
    })

    it('returns 401 with wrong secret', async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === 'user-agent') return 'vercel-cron/1.0'
          if (name === 'authorization') return 'Bearer wrong-secret'
          return null
        },
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(401)
    })

    it('allows requests in development without vercel-cron user-agent', async () => {
      process.env.NODE_ENV = 'development'
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === 'user-agent') return 'curl/7.0'
          if (name === 'authorization') return 'Bearer test-cron-secret'
          return null
        },
      })
      setupSupabaseMocks({ contentItems: [] })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
    })
  })

  describe('Processing Reminders', () => {
    it('returns ok when no reminders are due', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({ contentItems: [] })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })

    it('processes due reminders and sends emails', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({
        contentItems: [
          {
            id: 'content-1',
            body: 'Great fitness tip content here!',
            coach_id: 'coach-1',
            coaches: { email: 'coach@example.com', name: 'Jane' },
          },
        ],
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      expect(mockSendReminder).toHaveBeenCalledTimes(1)
      expect(mockSendReminder).toHaveBeenCalledWith(
        'coach@example.com',
        'Jane',
        'Great fitness tip content here!',
        'content-1',
        { hasWarning: false, warningReasons: [] }
      )
    })

    it('handles null coach name gracefully', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({
        contentItems: [
          {
            id: 'content-1',
            body: 'Content for coach with no name',
            coach_id: 'coach-1',
            coaches: { email: 'coach@example.com', name: null },
          },
        ],
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      expect(mockSendReminder).toHaveBeenCalledWith(
        'coach@example.com',
        'there',
        expect.any(String),
        'content-1',
        expect.any(Object)
      )
    })

    it('truncates long content preview to 500 chars', async () => {
      setupValidCronHeaders()
      const longBody = 'A'.repeat(600)
      setupSupabaseMocks({
        contentItems: [
          {
            id: 'content-1',
            body: longBody,
            coach_id: 'coach-1',
            coaches: { email: 'coach@example.com', name: 'Coach' },
          },
        ],
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      expect(mockSendReminder).toHaveBeenCalledWith(
        'coach@example.com',
        'Coach',
        expect.stringMatching(/^A{500}\.\.\.$/),
        'content-1',
        expect.any(Object)
      )
    })
  })

  describe('Content Moderation', () => {
    it('skips red-flagged content entirely', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({
        contentItems: [
          {
            id: 'red-content',
            body: 'This will cure all diseases!',
            coach_id: 'coach-1',
            coaches: { email: 'coach@example.com', name: 'Coach' },
          },
        ],
      })
      mockModerate.mockReturnValue({ rating: 'red', reasons: ['Contains blocked terms: cure'] })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      expect(mockSendReminder).not.toHaveBeenCalled()
    })

    it('sends warning email for yellow-flagged content', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({
        contentItems: [
          {
            id: 'yellow-content',
            body: 'I think this might work maybe',
            coach_id: 'coach-1',
            coaches: { email: 'coach@example.com', name: 'Coach' },
          },
        ],
      })
      mockModerate.mockReturnValue({
        rating: 'yellow',
        reasons: ['Contains hedging phrases: i think, maybe']
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      expect(mockSendReminder).toHaveBeenCalledWith(
        'coach@example.com',
        'Coach',
        expect.any(String),
        'yellow-content',
        { hasWarning: true, warningReasons: ['Contains hedging phrases: i think, maybe'] }
      )
    })

    it('sends normal email for green content', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({
        contentItems: [
          {
            id: 'green-content',
            body: 'Perfect content with no issues',
            coach_id: 'coach-1',
            coaches: { email: 'coach@example.com', name: 'Coach' },
          },
        ],
      })
      mockModerate.mockReturnValue({ rating: 'green', reasons: [] })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      expect(mockSendReminder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'green-content',
        { hasWarning: false, warningReasons: [] }
      )
    })
  })

  describe('Error Handling', () => {
    it('continues processing after individual email failure', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({
        contentItems: [
          {
            id: 'content-1',
            body: 'First content',
            coach_id: 'coach-1',
            coaches: { email: 'coach1@example.com', name: 'Coach 1' },
          },
          {
            id: 'content-2',
            body: 'Second content',
            coach_id: 'coach-2',
            coaches: { email: 'coach2@example.com', name: 'Coach 2' },
          },
        ],
      })
      mockSendReminder
        .mockRejectedValueOnce(new Error('Email failed'))
        .mockResolvedValueOnce(undefined)

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      expect(mockSendReminder).toHaveBeenCalledTimes(2)
    })

    it('continues processing after database update failure', async () => {
      setupValidCronHeaders()

      // First call returns content, update fails
      let callCount = 0
      mockServiceClient.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'content') {
            return {
              select: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                then: vi.fn((resolve: (value: unknown) => void) =>
                  resolve({
                    data: [
                      {
                        id: 'content-1',
                        body: 'Test content',
                        coach_id: 'coach-1',
                        coaches: { email: 'coach@example.com', name: 'Coach' },
                      },
                    ],
                    error: null,
                  })
                ),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Update failed' },
                }),
              }),
            }
          }
          if (table === 'system_health') {
            return {
              upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
            }
          }
          return {}
        }),
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })

    it('returns 500 on query failure', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({ queryError: new Error('Database connection failed') })

      const response = await GET(createRequest())

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Internal error')
    })
  })

  describe('System Health Recording', () => {
    it('writes stats to system_health table on success', async () => {
      setupValidCronHeaders()

      const upsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
      mockServiceClient.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'content') {
            return {
              select: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                then: vi.fn((resolve: (value: unknown) => void) =>
                  resolve({ data: [], error: null })
                ),
              }),
            }
          }
          if (table === 'system_health') {
            return { upsert: upsertFn }
          }
          return {}
        }),
      })

      await GET(createRequest())

      expect(upsertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'last_cron_run',
          value: expect.objectContaining({
            processed: 0,
            skipped: 0,
            errors: 0,
          }),
        }),
        { onConflict: 'key' }
      )
    })

    it('records error state when processing fails', async () => {
      setupValidCronHeaders()

      const upsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
      mockServiceClient.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'content') {
            return {
              select: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                then: vi.fn((resolve: (value: unknown) => void) =>
                  resolve({ data: null, error: new Error('Query failed') })
                ),
              }),
            }
          }
          if (table === 'system_health') {
            return { upsert: upsertFn }
          }
          return {}
        }),
      })

      await GET(createRequest())

      expect(upsertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'last_cron_run',
          value: expect.objectContaining({
            processed: 0,
            skipped: 0,
            errors: 1,
          }),
        }),
        { onConflict: 'key' }
      )
    })
  })

  describe('POST endpoint', () => {
    it('uses same logic as GET', async () => {
      setupValidCronHeaders()
      setupSupabaseMocks({ contentItems: [] })

      const response = await POST(createRequest())

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })
  })
})
