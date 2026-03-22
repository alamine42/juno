/**
 * Content suggestion logic for "What should I post today?" feature.
 * Analyzes framework usage and brand profile to suggest relevant content.
 */

import { createClient } from '@/lib/supabase/server'
import { FRAMEWORKS, type Framework } from './frameworks'

export interface ContentSuggestion {
  framework: Framework
  suggestedTopic: string
  reason: string
}

interface BrandProfile {
  target_audience?: string
  style_words?: string
  avoided_topics?: string
}

/**
 * Get framework usage counts for a coach in the last N days.
 */
async function getRecentFrameworkUsage(
  coachId: string,
  days: number = 7
): Promise<Record<string, number>> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days)

  // Query content table for framework_id usage
  const { data, error } = await supabase
    .from('content')
    .select('framework_id')
    .eq('coach_id', coachId)
    .gte('created_at', since.toISOString())
    .not('framework_id', 'is', null)

  if (error || !data) {
    return {}
  }

  const usage: Record<string, number> = {}
  for (const row of data) {
    if (row.framework_id) {
      usage[row.framework_id] = (usage[row.framework_id] || 0) + 1
    }
  }

  return usage
}

/**
 * Get coach's brand profile for topic generation.
 */
async function getBrandProfile(coachId: string): Promise<BrandProfile | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('brand_profiles')
    .select('target_audience, style_words, avoided_topics')
    .eq('coach_id', coachId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Generate a topic suggestion based on framework and brand profile.
 */
function generateTopicForFramework(framework: Framework, profile: BrandProfile | null): string {
  const audience = profile?.target_audience || 'your audience'
  const style = profile?.style_words || 'motivating'

  // Framework-specific topic templates
  const topicTemplates: Record<string, string[]> = {
    client_win: [
      `A recent client transformation story`,
      `How a client overcame their biggest obstacle`,
      `A milestone moment with one of your clients`,
    ],
    educational_carousel: [
      `Common mistakes ${audience} make`,
      `Step-by-step guide for ${audience}`,
      `Things I wish I knew when starting out`,
    ],
    engagement_hook: [
      `A hot take that challenges conventional wisdom`,
      `An unpopular opinion in your field`,
      `A myth that needs busting`,
    ],
    behind_the_scenes: [
      `Your morning routine`,
      `How you prepare for client sessions`,
      `A day in your life as a coach`,
    ],
    myth_buster: [
      `A common misconception about fitness`,
      `Why popular advice often backfires`,
      `The truth about quick fixes`,
    ],
  }

  const templates = topicTemplates[framework.id] || [`Something ${style} for ${audience}`]
  return templates[Math.floor(Math.random() * templates.length)]
}

/**
 * Find the least-used framework in the past week.
 */
function findLeastUsedFramework(usage: Record<string, number>): Framework {
  // Start with all frameworks having 0 usage
  const frameworkScores = FRAMEWORKS.map((fw) => ({
    framework: fw,
    count: usage[fw.id] || 0,
  }))

  // Sort by usage count (ascending), then by display_order for ties
  frameworkScores.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count
    return a.framework.display_order - b.framework.display_order
  })

  return frameworkScores[0].framework
}

/**
 * Generate a reason for the suggestion.
 */
function generateReason(framework: Framework, usageCount: number): string {
  if (usageCount === 0) {
    return `You haven't used ${framework.name} this week. It's great for variety!`
  }

  if (usageCount === 1) {
    return `You've only used ${framework.name} once this week. Your audience loves this format!`
  }

  // Find the framework with least usage
  return `${framework.name} keeps your content fresh and engaging.`
}

/**
 * Suggest content for a coach based on their usage patterns and brand profile.
 * Returns a framework suggestion with topic and reasoning.
 */
export async function suggestContent(coachId: string): Promise<ContentSuggestion> {
  // Get recent framework usage
  const usage = await getRecentFrameworkUsage(coachId)

  // Get brand profile for topic personalization
  const profile = await getBrandProfile(coachId)

  // Find least-used framework
  const framework = findLeastUsedFramework(usage)
  const usageCount = usage[framework.id] || 0

  // Generate topic and reason
  const suggestedTopic = generateTopicForFramework(framework, profile)
  const reason = generateReason(framework, usageCount)

  return {
    framework,
    suggestedTopic,
    reason,
  }
}

/**
 * Get content variety score (0-100) based on framework distribution.
 * Higher score = more variety in content types.
 */
export async function getVarietyScore(coachId: string): Promise<number> {
  const usage = await getRecentFrameworkUsage(coachId)
  const totalPosts = Object.values(usage).reduce((sum, count) => sum + count, 0)

  if (totalPosts === 0) return 0

  // Calculate how evenly distributed the frameworks are used
  const frameworkCount = FRAMEWORKS.length
  const idealPerFramework = totalPosts / frameworkCount

  // Sum of squared deviations from ideal
  let deviationSum = 0
  for (const fw of FRAMEWORKS) {
    const actual = usage[fw.id] || 0
    const deviation = Math.abs(actual - idealPerFramework)
    deviationSum += deviation * deviation
  }

  // Normalize to 0-100 (lower deviation = higher score)
  const maxDeviation = totalPosts * totalPosts // Worst case: all posts in one framework
  const normalizedDeviation = deviationSum / maxDeviation
  const score = Math.round((1 - normalizedDeviation) * 100)

  return Math.max(0, Math.min(100, score))
}
