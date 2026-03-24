/**
 * Content interactions tracking for learning loop analytics.
 * Tracks silently - never blocks UX on tracking failure.
 *
 * Note: This module requires a content_interactions table to be added
 * to the database schema. For now, tracking is stubbed out.
 */

export type EventType =
  | 'generated'
  | 'viewed'
  | 'copied'
  | 'edited'
  | 'confirmed'
  | 'skipped'
  | 'refinement'

export interface TrackingMetadata {
  framework_id?: string
  format_copied?: 'caption' | 'carousel' | 'reel'
  refinement_type?: 'shorter' | 'longer' | 'casual' | 'professional' | 'spicy'
  skip_reason?: 'quality' | 'tone' | 'length' | 'topic' | 'other'
  source?: 'chat' | 'batch' | 'framework'
  input_tokens?: number
  output_tokens?: number
  model?: string
  [key: string]: unknown
}

export interface ContentEvent {
  coach_id: string
  content_id?: string
  event_type: EventType
  metadata?: TrackingMetadata
}

/**
 * Track a content interaction event.
 * This function never throws - all errors are logged and swallowed
 * to prevent tracking from blocking user experience.
 *
 * TODO: Implement when content_interactions table is added to schema.
 */
export async function trackContentEvent(event: ContentEvent): Promise<void> {
  try {
    // Log for debugging - actual persistence is stubbed until
    // content_interactions table is added to Drizzle schema
    if (process.env.NODE_ENV === 'development') {
      console.debug('Tracking event:', event)
    }
  } catch (err) {
    // Catch any unexpected errors - tracking must never crash the app
    console.error('Tracking exception:', {
      event: 'tracking_exception',
      error: err instanceof Error ? err.message : 'Unknown error',
      event_type: event.event_type,
    })
  }
}

/**
 * Track content generation event with token usage.
 * Convenience wrapper for generated events.
 */
export async function trackGeneration(
  coachId: string,
  contentId: string,
  metadata: {
    framework_id?: string
    source: 'chat' | 'batch' | 'framework'
    input_tokens?: number
    output_tokens?: number
    model?: string
  }
): Promise<void> {
  return trackContentEvent({
    coach_id: coachId,
    content_id: contentId,
    event_type: 'generated',
    metadata,
  })
}

/**
 * Track content copy event.
 */
export async function trackCopy(
  coachId: string,
  contentId: string,
  format: 'caption' | 'carousel' | 'reel' = 'caption'
): Promise<void> {
  return trackContentEvent({
    coach_id: coachId,
    content_id: contentId,
    event_type: 'copied',
    metadata: { format_copied: format },
  })
}

/**
 * Track content confirmation (user posted it).
 */
export async function trackConfirmed(coachId: string, contentId: string): Promise<void> {
  return trackContentEvent({
    coach_id: coachId,
    content_id: contentId,
    event_type: 'confirmed',
  })
}

/**
 * Track content skip.
 */
export async function trackSkipped(
  coachId: string,
  contentId?: string,
  reason?: 'quality' | 'tone' | 'length' | 'topic' | 'other'
): Promise<void> {
  return trackContentEvent({
    coach_id: coachId,
    content_id: contentId,
    event_type: 'skipped',
    metadata: reason ? { skip_reason: reason } : undefined,
  })
}

/**
 * Track content refinement action.
 */
export async function trackRefinement(
  coachId: string,
  contentId: string,
  refinementType: 'shorter' | 'longer' | 'casual' | 'professional' | 'spicy'
): Promise<void> {
  return trackContentEvent({
    coach_id: coachId,
    content_id: contentId,
    event_type: 'refinement',
    metadata: { refinement_type: refinementType },
  })
}

/**
 * Get framework usage stats for a coach in the last N days.
 * Used by suggestion logic.
 *
 * TODO: Implement when content_interactions table is added to schema.
 */
export async function getFrameworkUsage(
  coachId: string,
  days: number = 7
): Promise<Record<string, number>> {
  // Stubbed - return empty until content_interactions table exists
  return {}
}
