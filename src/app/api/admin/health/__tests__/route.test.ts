import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks
const { mockCreateClient, mockCreateServiceClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateServiceClient: vi.fn(),
}))

// Mock supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mockCreateServiceClient,
}))

import { GET } from '../route'

function setupMocks(overrides: {
  user?: { id: string } | null
  isAdmin?: boolean
  coachError?: Error | null
  databaseCheckError?: Error | null
  healthData?: {
    value: { timestamp: string; processed: number; skipped: number; errors: number }
  } | null
  healthError?: Error | null
} = {}) {
  const user = overrides.user === undefined ? { id: 'user-123' } : overrides.user

  // Mock createClient (for auth)
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  })

  // Mock createServiceClient (for admin check and health queries)
  mockCreateServiceClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'coaches') {
        // First call: is_admin check, second call: database health check
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: overrides.coachError ? null : { is_admin: overrides.isAdmin ?? false },
                error: overrides.coachError ?? null,
              }),
              limit: vi.fn().mockResolvedValue({
                data: overrides.databaseCheckError ? null : [{ id: 'test' }],
                error: overrides.databaseCheckError ?? null,
              }),
            }),
            limit: vi.fn().mockResolvedValue({
              data: overrides.databaseCheckError ? null : [{ id: 'test' }],
              error: overrides.databaseCheckError ?? null,
            }),
          }),
        }
      }
      if (table === 'system_health') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: overrides.healthData ?? null,
                error: overrides.healthError ?? null,
              }),
            }),
          }),
        }
      }
      return {}
    }),
  })
}

describe('Admin Health API Route', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Authentication', () => {
    it('returns 401 when not authenticated', async () => {
      setupMocks({ user: null })

      const response = await GET()

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 403 when user is not admin', async () => {
      setupMocks({ user: { id: 'user-123' }, isAdmin: false })

      const response = await GET()

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('Forbidden')
    })

    it('returns 403 when coach lookup fails', async () => {
      setupMocks({
        user: { id: 'user-123' },
        coachError: new Error('Not found'),
      })

      const response = await GET()

      expect(response.status).toBe(403)
    })

    it('allows admin users', async () => {
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
      })

      const response = await GET()

      expect(response.status).toBe(200)
    })
  })

  describe('Health Status', () => {
    it('returns ok status when all services healthy', async () => {
      const recentTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
        healthData: {
          value: {
            timestamp: recentTimestamp,
            processed: 5,
            skipped: 1,
            errors: 0,
          },
        },
      })

      const response = await GET()

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('ok')
      expect(body.services.database).toBe('ok')
      expect(body.services.cron.status).toBe('ok')
    })

    it('returns degraded status when cron is stale', async () => {
      const staleTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
        healthData: {
          value: {
            timestamp: staleTimestamp,
            processed: 0,
            skipped: 0,
            errors: 0,
          },
        },
      })

      const response = await GET()

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('degraded')
      expect(body.services.cron.status).toBe('stale')
    })

    it('returns never status when no cron data', async () => {
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
        healthData: null,
      })

      const response = await GET()

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.services.cron.status).toBe('never')
      expect(body.services.cron.lastRun).toBeNull()
    })

    it('returns down status when database fails', async () => {
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
        databaseCheckError: new Error('Connection failed'),
      })

      const response = await GET()

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('down')
      expect(body.services.database).toBe('error')
    })
  })

  describe('Response Structure', () => {
    it('includes all required fields', async () => {
      const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
        healthData: {
          value: {
            timestamp: recentTimestamp,
            processed: 10,
            skipped: 2,
            errors: 1,
          },
        },
      })

      const response = await GET()

      expect(response.status).toBe(200)
      const body = await response.json()

      // Top-level fields
      expect(body.status).toBeDefined()
      expect(body.timestamp).toBeDefined()
      expect(body.version).toBeDefined()
      expect(body.services).toBeDefined()

      // Services structure
      expect(body.services.database).toBeDefined()
      expect(body.services.cron).toBeDefined()
      expect(body.services.cron.lastRun).toBeDefined()
      expect(body.services.cron.status).toBeDefined()
      expect(body.services.cron.processed).toBe(10)
      expect(body.services.cron.skipped).toBe(2)
      expect(body.services.cron.errors).toBe(1)
    })

    it('returns version from environment or default', async () => {
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
      })

      const response = await GET()

      const body = await response.json()
      expect(body.version).toBeDefined()
      // Should be either the env var or default '1.0.0'
      expect(typeof body.version).toBe('string')
    })

    it('returns ISO timestamp', async () => {
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
      })

      const response = await GET()

      const body = await response.json()
      // Verify it's a valid ISO timestamp
      const parsed = new Date(body.timestamp)
      expect(parsed.toISOString()).toBe(body.timestamp)
    })
  })

  describe('Cron Health Details', () => {
    it('includes cron statistics when available', async () => {
      const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
        healthData: {
          value: {
            timestamp: recentTimestamp,
            processed: 15,
            skipped: 3,
            errors: 0,
          },
        },
      })

      const response = await GET()

      const body = await response.json()
      expect(body.services.cron.processed).toBe(15)
      expect(body.services.cron.skipped).toBe(3)
      expect(body.services.cron.errors).toBe(0)
      expect(body.services.cron.lastRun).toBe(recentTimestamp)
    })

    it('handles system_health query error gracefully', async () => {
      setupMocks({
        user: { id: 'admin-123' },
        isAdmin: true,
        healthError: new Error('Table not found'),
      })

      const response = await GET()

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.services.cron.status).toBe('never')
      expect(body.services.cron.lastRun).toBeNull()
    })
  })
})
