/**
 * Content moderation system for fitness/wellness content.
 * Classifies content as Green (safe), Yellow (needs review), or Red (blocked).
 */

export type ModerationRating = 'green' | 'yellow' | 'red'

export interface ModerationResult {
  rating: ModerationRating
  reasons: string[]
}

// Red blocklist - content that should never be posted (legal/safety risk)
const RED_BLOCKLIST = [
  'cure',
  'treat disease',
  'cures disease',
  'weight loss guarantee',
  'guaranteed weight loss',
  'fda approved',
  'steroids',
  'anabolic',
  'pharmaceutical grade',
  'prescription strength',
  'doctor recommended',  // unless they are a doctor
  'clinically proven',   // requires actual clinical proof
  'miracle',
  'secret formula',
] as const

// Yellow flags - content that may need review
const YELLOW_HEDGING_PHRASES = [
  'i think',
  'maybe',
  'probably',
  'might work',
  'could potentially',
  'some people say',
  'supposedly',
  'i\'m not sure but',
] as const

// Content length constraints
const MIN_CONTENT_LENGTH = 50
const MAX_CONTENT_LENGTH = 2200 // Instagram caption limit

/**
 * Check content against red blocklist.
 * Returns list of matched blocked terms.
 */
function checkBlocklist(content: string): string[] {
  const lowerContent = content.toLowerCase()
  const matched: string[] = []

  for (const term of RED_BLOCKLIST) {
    if (lowerContent.includes(term)) {
      matched.push(term)
    }
  }

  return matched
}

/**
 * Check content for yellow flag hedging phrases.
 * Returns list of matched phrases.
 */
function checkHedgingPhrases(content: string): string[] {
  const lowerContent = content.toLowerCase()
  const matched: string[] = []

  for (const phrase of YELLOW_HEDGING_PHRASES) {
    if (lowerContent.includes(phrase)) {
      matched.push(phrase)
    }
  }

  return matched
}

/**
 * Check content length constraints.
 * Returns reasons if length is problematic.
 */
function checkContentLength(content: string): string[] {
  const reasons: string[] = []
  const trimmed = content.trim()

  if (trimmed.length === 0) {
    reasons.push('Content is empty')
  } else if (trimmed.length < MIN_CONTENT_LENGTH) {
    reasons.push(`Content is too short (${trimmed.length} chars, minimum ${MIN_CONTENT_LENGTH})`)
  }

  if (trimmed.length > MAX_CONTENT_LENGTH) {
    reasons.push(`Content exceeds Instagram limit (${trimmed.length} chars, maximum ${MAX_CONTENT_LENGTH})`)
  }

  return reasons
}

/**
 * Moderate content and return rating with reasons.
 *
 * Rating levels:
 * - Red: Blocked - contains dangerous health claims or blocklisted terms
 * - Yellow: Warning - may need review (too short, too long, hedging language)
 * - Green: Safe - passes all checks
 */
export function moderateContent(content: string): ModerationResult {
  const reasons: string[] = []
  let rating: ModerationRating = 'green'

  // Check blocklist (red flags)
  const blockedTerms = checkBlocklist(content)
  if (blockedTerms.length > 0) {
    return {
      rating: 'red',
      reasons: [`Contains blocked terms: ${blockedTerms.join(', ')}`],
    }
  }

  // Check length constraints
  const lengthIssues = checkContentLength(content)
  if (lengthIssues.length > 0) {
    // Empty content is yellow, not red
    reasons.push(...lengthIssues)
    rating = 'yellow'
  }

  // Check hedging phrases
  const hedgingPhrases = checkHedgingPhrases(content)
  if (hedgingPhrases.length > 0) {
    reasons.push(`Contains hedging phrases: ${hedgingPhrases.join(', ')}`)
    rating = 'yellow'
  }

  return { rating, reasons }
}

/**
 * Check if content is blocked (red rating).
 * Convenience function for quick checks.
 */
export function isContentBlocked(content: string): boolean {
  const result = moderateContent(content)
  return result.rating === 'red'
}

/**
 * Get the blocklist for reference (e.g., for UI warnings).
 */
export function getBlocklist(): readonly string[] {
  return RED_BLOCKLIST
}
