import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateCost,
  log,
  logError,
  logGeneration,
  logRequest,
  startTimer,
} from '../logging'

describe('logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateCost', () => {
    it('calculates cost for token usage', () => {
      const cost = calculateCost({
        input_tokens: 1000,
        output_tokens: 500,
        model: 'claude-sonnet-4-20250514',
      })

      // 1000 input tokens @ $3/1M = $0.003
      // 500 output tokens @ $15/1M = $0.0075
      // Total = $0.0105
      expect(cost).toBeCloseTo(0.0105, 4)
    })

    it('handles zero tokens', () => {
      const cost = calculateCost({
        input_tokens: 0,
        output_tokens: 0,
        model: 'claude-sonnet-4-20250514',
      })

      expect(cost).toBe(0)
    })

    it('handles large token counts', () => {
      const cost = calculateCost({
        input_tokens: 1_000_000,
        output_tokens: 100_000,
        model: 'claude-sonnet-4-20250514',
      })

      // 1M input @ $3 = $3
      // 100K output @ $15/1M = $1.5
      // Total = $4.5
      expect(cost).toBeCloseTo(4.5, 2)
    })
  })

  describe('log', () => {
    it('logs JSON with timestamp', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      log({ event: 'test_event', coach_id: 'coach-123' })

      expect(consoleSpy).toHaveBeenCalledTimes(1)
      const logged = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logged.event).toBe('test_event')
      expect(logged.coach_id).toBe('coach-123')
      expect(logged.timestamp).toBeDefined()

      consoleSpy.mockRestore()
    })
  })

  describe('logError', () => {
    it('logs error with level', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      logError({ event: 'error_event', error: 'Something failed' })

      expect(consoleSpy).toHaveBeenCalledTimes(1)
      const logged = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logged.event).toBe('error_event')
      expect(logged.level).toBe('error')
      expect(logged.error).toBe('Something failed')

      consoleSpy.mockRestore()
    })
  })

  describe('logGeneration', () => {
    it('logs generation with token usage and cost', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      logGeneration(
        'coach-123',
        {
          input_tokens: 500,
          output_tokens: 200,
          model: 'claude-sonnet-4-20250514',
        },
        {
          content_id: 'content-456',
          framework_id: 'client_win',
          source: 'chat',
          latency_ms: 1234,
        }
      )

      const logged = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logged.event).toBe('generation')
      expect(logged.coach_id).toBe('coach-123')
      expect(logged.input_tokens).toBe(500)
      expect(logged.output_tokens).toBe(200)
      expect(logged.total_tokens).toBe(700)
      expect(logged.model).toBe('claude-sonnet-4-20250514')
      expect(logged.estimated_cost_usd).toBeGreaterThan(0)
      expect(logged.content_id).toBe('content-456')
      expect(logged.framework_id).toBe('client_win')
      expect(logged.latency_ms).toBe(1234)

      consoleSpy.mockRestore()
    })
  })

  describe('logRequest', () => {
    it('logs API request details', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      logRequest('/api/content', 'POST', 201, 150, {
        coach_id: 'coach-123',
      })

      const logged = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logged.event).toBe('api_request')
      expect(logged.route).toBe('/api/content')
      expect(logged.method).toBe('POST')
      expect(logged.status_code).toBe(201)
      expect(logged.latency_ms).toBe(150)
      expect(logged.coach_id).toBe('coach-123')

      consoleSpy.mockRestore()
    })

    it('logs request with error', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      logRequest('/api/content', 'POST', 500, 50, {
        error: 'Database connection failed',
        error_code: 'DB_ERROR',
      })

      const logged = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logged.status_code).toBe(500)
      expect(logged.error).toBe('Database connection failed')
      expect(logged.error_code).toBe('DB_ERROR')

      consoleSpy.mockRestore()
    })
  })

  describe('startTimer', () => {
    it('measures elapsed time', async () => {
      const getLatency = startTimer()

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      const latency = getLatency()
      expect(latency).toBeGreaterThanOrEqual(9) // Allow some variance
      expect(latency).toBeLessThan(100)
    })

    it('can be called multiple times', () => {
      const getLatency = startTimer()

      const first = getLatency()
      const second = getLatency()

      expect(second).toBeGreaterThanOrEqual(first)
    })
  })
})
