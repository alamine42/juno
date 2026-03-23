import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GET } from '../route'

describe('Public Health API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const response = await GET()

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('ok')
    })

    it('returns timestamp', async () => {
      const beforeCall = new Date().toISOString()
      const response = await GET()
      const afterCall = new Date().toISOString()

      const body = await response.json()
      expect(body.timestamp).toBeDefined()

      // Verify timestamp is between before and after call
      expect(body.timestamp >= beforeCall).toBe(true)
      expect(body.timestamp <= afterCall).toBe(true)
    })

    it('does not expose internal state', async () => {
      const response = await GET()

      const body = await response.json()

      // Should NOT contain any internal info
      expect(body.database).toBeUndefined()
      expect(body.cron).toBeUndefined()
      expect(body.services).toBeUndefined()
      expect(body.version).toBeUndefined()
      expect(body.errors).toBeUndefined()
    })

    it('returns minimal response structure', async () => {
      const response = await GET()

      const body = await response.json()
      const keys = Object.keys(body)

      // Should only have status and timestamp
      expect(keys).toHaveLength(2)
      expect(keys).toContain('status')
      expect(keys).toContain('timestamp')
    })
  })
})
