/**
 * Composable prompt building module for Claude API.
 *
 * Key security features:
 * - User-provided content wrapped in XML tags to prevent injection
 * - Anti-slop segment bans generic AI phrases
 * - Clear separation between system instructions and user data
 */

import type { Tables } from '@/types/database'

// Pick only the fields relevant for prompt building
export type BrandProfileForPrompt = Pick<
  Tables<'brand_profiles'>,
  | 'style_words'
  | 'tone'
  | 'emoji_usage'
  | 'sign_off'
  | 'avoided_topics'
  | 'avoided_words'
  | 'preferred_words'
  | 'target_audience'
  | 'example_posts'
>

export interface FrameworkForPrompt {
  name: string
  prompt_template: string
}

export interface SystemPromptOptions {
  brandProfile?: BrandProfileForPrompt | null
  framework?: FrameworkForPrompt | null
  frameworkAnswers?: Record<string, string> | null
  formats?: string[]
}

/**
 * XML-escape user content to prevent injection attacks.
 * Escapes: & < > " '
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Build the base system identity segment.
 */
export function buildBaseSegment(): string {
  return `You are Juno, an AI assistant for fitness and wellness coaches.
You help create Instagram content that sounds authentic to the coach's voice.
You are encouraging, professional, and focused on helping coaches succeed.`
}

/**
 * Build the voice segment from coach's brand profile.
 * Wraps user-provided data in XML tags to prevent prompt injection.
 */
export function buildVoiceSegment(profile: BrandProfileForPrompt | null): string {
  if (!profile) {
    return `\n\nThe coach hasn't set up their brand profile yet. Use a friendly, professional tone.
Ask clarifying questions about their style if the request is ambiguous.`
  }

  const parts: string[] = ['\n\n## This Coach\'s Brand Voice\n']

  // Wrap all user-provided data in XML tags with escaping
  parts.push('<coach_data>')

  if (profile.style_words) {
    parts.push(`<style>${escapeXml(profile.style_words)}</style>`)
  }
  if (profile.tone) {
    parts.push(`<tone>${escapeXml(profile.tone)}</tone>`)
  }
  if (profile.emoji_usage) {
    parts.push(`<emoji_usage>${escapeXml(profile.emoji_usage)}</emoji_usage>`)
  }
  if (profile.sign_off) {
    parts.push(`<sign_off>${escapeXml(profile.sign_off)}</sign_off>`)
  }
  if (profile.target_audience) {
    parts.push(`<target_audience>${escapeXml(profile.target_audience)}</target_audience>`)
  }
  if (profile.preferred_words?.length) {
    parts.push(`<preferred_words>${profile.preferred_words.map(escapeXml).join(', ')}</preferred_words>`)
  }
  if (profile.avoided_words?.length) {
    parts.push(`<avoided_words>${profile.avoided_words.map(escapeXml).join(', ')}</avoided_words>`)
  }
  if (profile.avoided_topics?.length) {
    parts.push(`<avoided_topics>${profile.avoided_topics.map(escapeXml).join(', ')}</avoided_topics>`)
  }
  if (profile.example_posts?.length) {
    parts.push('<example_posts>')
    profile.example_posts.forEach((post, i) => {
      const truncated = post.length > 500 ? post.slice(0, 500) + '...' : post
      parts.push(`<post index="${i + 1}">${escapeXml(truncated)}</post>`)
    })
    parts.push('</example_posts>')
  }

  parts.push('</coach_data>')

  parts.push('\nMatch this voice exactly. Don\'t be generic—sound like THIS coach.')

  return parts.join('\n')
}

/**
 * Anti-slop segment: bans generic AI phrases and encourages authenticity.
 */
export function buildAntiSlopSegment(): string {
  return `

## Writing Quality Requirements

BANNED PHRASES (never use these):
- "In today's fast-paced world"
- "Unlock your potential"
- "Take your journey to the next level"
- "Game-changer"
- "Let's dive in"
- "Elevate your"
- "Transform your"
- "Embark on"
- "Harness the power"
- "It's not just about X, it's about Y"
- Starting with "So," or "Well,"
- Excessive exclamation points (max 2 per post)

AUTHENTICITY MARKERS (do include):
- Specific, concrete examples
- Personal anecdotes when appropriate
- Conversational language the coach actually uses
- Questions that invite genuine engagement
- Real numbers and timeframes when relevant

Write like a real human coach, not a marketing AI.`
}

/**
 * Build framework-specific segment by interpolating answers into template.
 */
export function buildFrameworkSegment(
  framework: FrameworkForPrompt | null,
  answers: Record<string, string> | null
): string {
  if (!framework || !answers) {
    return ''
  }

  let template = framework.prompt_template

  // Interpolate answers into template placeholders like {{question_key}}
  // Escape user answers to prevent injection
  for (const [key, value] of Object.entries(answers)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    template = template.replace(placeholder, escapeXml(value))
  }

  return `

## Content Framework: ${escapeXml(framework.name)}

<framework_instructions>
${template}
</framework_instructions>`
}

/**
 * Build format instructions segment for multi-format output.
 */
export function buildFormatSegment(formats: string[] | undefined): string {
  if (!formats?.length) {
    return ''
  }

  const formatList = formats.map(f => `- ${escapeXml(f)}`).join('\n')

  return `

## Output Formats

Generate content in these formats:
${formatList}

Separate each format with a clear heading.`
}

/**
 * Compose all segments into a complete system prompt.
 */
export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const { brandProfile, framework, frameworkAnswers, formats } = options

  const segments = [
    buildBaseSegment(),
    buildVoiceSegment(brandProfile ?? null),
    buildAntiSlopSegment(),
    buildFrameworkSegment(framework ?? null, frameworkAnswers ?? null),
    buildFormatSegment(formats),
  ]

  return segments.join('')
}
