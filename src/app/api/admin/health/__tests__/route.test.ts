import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock auth
const mockAuth = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}))

// Mock hasAdminClaim
const mockHasAdminClaim = vi.fn()
vi.mock('@/types/clerk', () => ({
  hasAdminClaim: (claims: unknown) => mockHasAdminClaim(claims),
}))

// Mock db
const mockDbSelect = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    select: () => mockDbSelect(),
  },
}))

import { GET } from '../route'

function setupMocks(overrides: {
  userId?: string | null
  isAdminClaim?: boolean
  isAdminDb?: boolean
  databaseCheckError?: Error | null
  healthData?: {
    value: { timestamp: string; processed: number; skipped: number; errors: number }
    updatedAt: Date
  } | null
  healthError?: Error | null
} = {}) {
  const userId = overrides.userId === undefined ? 'user-123' : overrides.userId

  mockAuth.mockReturnValue({
    userId,
    sessionClaims: userId ? { metadata: { isAdmin: overrides.isAdminClaim ?? false } } : {},
  })

  mockHasAdminClaim.mockReturnValue(overrides.isAdminClaim ?? false)

  // Setup db.select() chain
  let callCount = 0
  mockDbSelect.mockImplementation(() => {
    callCount++
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          // First call: admin check from coaches table
          if (callCount === 1) {
            return Promise.resolve([{ isAdmin: overrides.isAdminDb ?? false }])
          }
          // Third call: systemHealth query
          if (overrides.healthError) {
            return Promise.reject(overrides.healthError)
          }
          return Promise.resolve(overrides.healthData ? [overrides.healthData] : [])
        }),
        limit: vi.fn().mockImplementation(() => {
          // Second call: database health check
          if (overrides.databaseCheckError) {
            return Promise.reject(overrides.databaseCheckError)
          }
          return Promise.resolve([{ id: 'test' }])
        }),
      }),
    }
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
      setupMocks({ userId: null })

      const response = await GET()

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 403 when user is not admin', async () => {
      setupMocks({ userId: 'user-123', isAdminClaim: false, isAdminDb: false })

      const response = await GET()

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('Forbidden')
    })

    it('allows admin users via Clerk claims', async () => {
      setupMocks({
        userId: 'admin-123',
        isAdminClaim: true,
      })

      const response = await GET()

      expect(response.status).toBe(200)
    })

    it('allows admin users via database flag', async () => {
      setupMocks({
        userId: 'admin-123',
        isAdminClaim: false,
        isAdminDb: true,
      })

      const response = await GET()

      expect(response.status).toBe(200)
    })
  })

  describe('Health Status', () => {
    it('returns ok status when all services healthy', async () => {
      const recentTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago
      setupMocks({
        userId: 'admin-123',
        isAdminClaim: true,
        healthData: {
          value: {
            timestamp: recentTimestamp,
            processed: 5,
            skipped: 1,
            errors: 0,
          },
          updatedAt: new Date(),
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
        userId: 'admin-123',
        isAdminClaim: true,
        healthData: {
          value: {
            timestamp: staleTimestamp,
            processed: 0,
            skipped: 0,
            errors: 0,
          },
          updatedAt: new Date(),
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
        userId: 'admin-123',
        isAdminClaim: true,
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
        userId: 'admin-123',
        isAdminClaim: true,
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
        userId: 'admin-123',
        isAdminClaim: true,
        healthData: {
          value: {
            timestamp: recentTimestamp,
            processed: 10,
            skipped: 2,
            errors: 1,
          },
          updatedAt: new Date(),
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
        userId: 'admin-123',
        isAdminClaim: true,
      })

      const response = await GET()

      const body = await response.json()
      expect(body.version).toBeDefined()
      expect(typeof body.version).toBe('string')
    })

    it('returns ISO timestamp', async () => {
      setupMocks({
        userId: 'admin-123',
        isAdminClaim: true,
      })

      const response = await GET()

      const body = await response.json()
      const parsed = new Date(body.timestamp)
      expect(parsed.toISOString()).toBe(body.timestamp)
    })
  })

  describe('Cron Health Details', () => {
    it('includes cron statistics when available', async () => {
      const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      setupMocks({
        userId: 'admin-123',
        isAdminClaim: true,
        healthData: {
          value: {
            timestamp: recentTimestamp,
            processed: 15,
            skipped: 3,
            errors: 0,
          },
          updatedAt: new Date(),
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
        userId: 'admin-123',
        isAdminClaim: true,
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
