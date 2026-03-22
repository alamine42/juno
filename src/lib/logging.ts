/**
 * Structured logging for API routes and Claude API calls.
 * Uses JSON format for Vercel log ingestion.
 */

// Cost per 1M tokens (as of 2024, Claude 3.5 Sonnet)
const COST_PER_1M_INPUT_TOKENS = 3.0
const COST_PER_1M_OUTPUT_TOKENS = 15.0

export interface LogContext {
  event: string
  coach_id?: string
  content_id?: string
  framework_id?: string
  route?: string
  method?: string
  status_code?: number
  latency_ms?: number
  error?: string
  error_code?: string
  [key: string]: unknown
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  model: string
}

export interface GenerationLogContext extends LogContext {
  event: 'generation'
  input_tokens: number
  output_tokens: number
  total_tokens: number
  model: string
  estimated_cost_usd: number
}

/**
 * Calculate estimated cost from token usage.
 */
export function calculateCost(usage: TokenUsage): number {
  const inputCost = (usage.input_tokens / 1_000_000) * COST_PER_1M_INPUT_TOKENS
  const outputCost = (usage.output_tokens / 1_000_000) * COST_PER_1M_OUTPUT_TOKENS
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000 // Round to 6 decimal places
}

/**
 * Log a structured JSON event.
 * All logs include timestamp automatically.
 */
export function log(context: LogContext): void {
  const entry = {
    ...context,
    timestamp: new Date().toISOString(),
  }
  console.log(JSON.stringify(entry))
}

/**
 * Log an error event.
 */
export function logError(context: LogContext): void {
  const entry = {
    ...context,
    level: 'error',
    timestamp: new Date().toISOString(),
  }
  console.error(JSON.stringify(entry))
}

/**
 * Log a Claude API generation with token usage and cost.
 */
export function logGeneration(
  coachId: string,
  usage: TokenUsage,
  extras?: {
    content_id?: string
    framework_id?: string
    source?: 'chat' | 'batch' | 'framework'
    latency_ms?: number
  }
): void {
  const context: GenerationLogContext = {
    event: 'generation',
    coach_id: coachId,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.input_tokens + usage.output_tokens,
    model: usage.model,
    estimated_cost_usd: calculateCost(usage),
    ...extras,
  }
  log(context)
}

/**
 * Log an API route request.
 */
export function logRequest(
  route: string,
  method: string,
  statusCode: number,
  latencyMs: number,
  extras?: {
    coach_id?: string
    error?: string
    error_code?: string
  }
): void {
  log({
    event: 'api_request',
    route,
    method,
    status_code: statusCode,
    latency_ms: latencyMs,
    ...extras,
  })
}

/**
 * Create a timer for measuring latency.
 */
export function startTimer(): () => number {
  const start = performance.now()
  return () => Math.round(performance.now() - start)
}

/**
 * Wrap an async handler with automatic request logging.
 */
export function withLogging<T>(
  route: string,
  method: string,
  handler: () => Promise<{ status: number; result: T; coachId?: string }>
): Promise<T> {
  const getLatency = startTimer()

  return handler()
    .then(({ status, result, coachId }) => {
      logRequest(route, method, status, getLatency(), { coach_id: coachId })
      return result
    })
    .catch((error) => {
      logRequest(route, method, 500, getLatency(), {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    })
}
