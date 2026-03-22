/**
 * Content interactions tracking for learning loop analytics.
 * Tracks silently - never blocks UX on tracking failure.
 */

import { createClient } from '@/lib/supabase/server'

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
 */
export async function trackContentEvent(event: ContentEvent): Promise<void> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('content_interactions').insert({
      coach_id: event.coach_id,
      content_id: event.content_id ?? null,
      event_type: event.event_type,
      metadata: event.metadata ?? {},
    })

    if (error) {
      // Log but don't throw - tracking should never block UX
      console.error('Tracking error:', {
        event: 'tracking_failed',
        error: error.message,
        code: error.code,
        event_type: event.event_type,
      })
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
 */
export async function getFrameworkUsage(
  coachId: string,
  days: number = 7
): Promise<Record<string, number>> {
  try {
    const supabase = await createClient()
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('content_interactions')
      .select('metadata')
      .eq('coach_id', coachId)
      .eq('event_type', 'generated')
      .gte('created_at', since.toISOString())

    if (error || !data) {
      return {}
    }

    const usage: Record<string, number> = {}
    for (const row of data) {
      const frameworkId = (row.metadata as TrackingMetadata)?.framework_id
      if (frameworkId) {
        usage[frameworkId] = (usage[frameworkId] || 0) + 1
      }
    }

    return usage
  } catch {
    return {}
  }
}
