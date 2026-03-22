/**
 * Configurable sliding window rate limiter.
 * In production, consider using Redis for persistence across instances.
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (use Redis in production for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Default configs for different use cases
export const RATE_LIMIT_PRESETS = {
  chat: { maxRequests: 20, windowMs: 60_000 },          // 20 req/min
  content: { maxRequests: 30, windowMs: 60_000 },       // 30 req/min
  batch: { maxRequests: 5, windowMs: 60_000 },          // 5 req/min (expensive)
  frameworks: { maxRequests: 60, windowMs: 60_000 },    // 60 req/min (read-only)
} as const

/**
 * Check if a request should be allowed under rate limiting.
 * @param key Unique identifier (usually userId + endpoint)
 * @param config Rate limit configuration
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // First request or window expired
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs })
    return true
  }

  // Within window, check limit
  if (entry.count >= config.maxRequests) {
    return false
  }

  entry.count++
  return true
}

/**
 * Get remaining requests for a key.
 * @param key Unique identifier
 * @param config Rate limit configuration
 * @returns Object with remaining requests and reset time
 */
export function getRateLimitInfo(key: string, config: RateLimitConfig): {
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    return { remaining: config.maxRequests, resetAt: now + config.windowMs }
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  }
}

/**
 * Clear rate limit entry for a key (useful for testing).
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

/**
 * Clear all rate limit entries (useful for testing).
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear()
}
