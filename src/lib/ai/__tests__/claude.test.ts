import { describe, it, expect, vi } from 'vitest'

// Mock Anthropic SDK before importing claude
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: vi.fn() }
  },
}))

// Mock environment variables before importing claude
vi.mock('@/lib/env', () => ({
  ANTHROPIC_API_KEY: 'test-key',
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
}))

import {
  parseMultiFormatResponse,
  serializeMultiFormat,
  deserializeMultiFormat,
} from '../claude'

describe('parseMultiFormatResponse', () => {
  it('extracts all three formats when present', () => {
    const text = `
      <caption>This is a great caption for Instagram!</caption>
      <carousel>
        Slide 1: Introduction
        Slide 2: Key Point
        Slide 3: Conclusion
      </carousel>
      <reel>
        0-5s: Hook your audience
        5-15s: Share the tip
        15-30s: Call to action
      </reel>
    `
    const result = parseMultiFormatResponse(text)

    expect(result.hasContent).toBe(true)
    expect(result.formats.caption).toBe('This is a great caption for Instagram!')
    expect(result.formats.carousel).toContain('Slide 1: Introduction')
    expect(result.formats.reel).toContain('Hook your audience')
    expect(result.warnings).toHaveLength(0)
  })

  it('handles partial response with only caption', () => {
    const text = '<caption>Just a single caption here</caption>'
    const result = parseMultiFormatResponse(text)

    expect(result.hasContent).toBe(true)
    expect(result.formats.caption).toBe('Just a single caption here')
    expect(result.formats.carousel).toBeUndefined()
    expect(result.formats.reel).toBeUndefined()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('Missing formats')
  })

  it('handles partial response with caption and carousel', () => {
    const text = `
      <caption>My caption</caption>
      <carousel>Slide content here</carousel>
    `
    const result = parseMultiFormatResponse(text)

    expect(result.hasContent).toBe(true)
    expect(result.formats.caption).toBe('My caption')
    expect(result.formats.carousel).toBe('Slide content here')
    expect(result.formats.reel).toBeUndefined()
    expect(result.warnings[0]).toContain('reel')
  })

  it('returns warning when no tags found', () => {
    const text = 'Just plain text without any XML tags'
    const result = parseMultiFormatResponse(text)

    expect(result.hasContent).toBe(false)
    expect(result.formats).toEqual({})
    expect(result.warnings).toContain('No valid format tags found in response')
  })

  it('handles empty tags gracefully', () => {
    const text = `
      <caption></caption>
      <carousel>Valid carousel content</carousel>
    `
    const result = parseMultiFormatResponse(text)

    expect(result.hasContent).toBe(true)
    expect(result.formats.caption).toBeUndefined()
    expect(result.formats.carousel).toBe('Valid carousel content')
    expect(result.warnings.some((w) => w.includes('Empty content'))).toBe(true)
  })

  it('handles whitespace-only tags', () => {
    const text = `
      <caption>   </caption>
      <reel>Valid reel content</reel>
    `
    const result = parseMultiFormatResponse(text)

    expect(result.formats.caption).toBeUndefined()
    expect(result.formats.reel).toBe('Valid reel content')
  })

  it('is case-insensitive for tags', () => {
    const text = `
      <CAPTION>Upper case caption</CAPTION>
      <Carousel>Mixed case carousel</Carousel>
      <ReEl>Mixed reel</ReEl>
    `
    const result = parseMultiFormatResponse(text)

    expect(result.formats.caption).toBe('Upper case caption')
    expect(result.formats.carousel).toBe('Mixed case carousel')
    expect(result.formats.reel).toBe('Mixed reel')
  })

  it('handles multiline content within tags', () => {
    const text = `
      <carousel>
Slide 1: Hook
- Get attention with a bold statement

Slide 2: Problem
- Describe the pain point

Slide 3: Solution
- Present your answer
      </carousel>
    `
    const result = parseMultiFormatResponse(text)

    expect(result.formats.carousel).toContain('Slide 1: Hook')
    expect(result.formats.carousel).toContain('Slide 2: Problem')
    expect(result.formats.carousel).toContain('Slide 3: Solution')
  })

  it('handles extra text outside tags', () => {
    const text = `
      Here's your content:

      <caption>The actual caption</caption>

      Hope this helps!
    `
    const result = parseMultiFormatResponse(text)

    expect(result.formats.caption).toBe('The actual caption')
    expect(result.formats.caption).not.toContain("Here's your content")
  })
})

describe('serializeMultiFormat', () => {
  it('serializes all formats to JSON', () => {
    const content = {
      caption: 'Test caption',
      carousel: 'Test carousel',
      reel: 'Test reel',
    }
    const result = serializeMultiFormat(content)

    expect(result).toBe(JSON.stringify(content))
    expect(JSON.parse(result)).toEqual(content)
  })

  it('serializes partial content', () => {
    const content = { caption: 'Only caption' }
    const result = serializeMultiFormat(content)

    expect(JSON.parse(result)).toEqual({ caption: 'Only caption' })
  })
})

describe('deserializeMultiFormat', () => {
  it('parses valid JSON with all formats', () => {
    const json = JSON.stringify({
      caption: 'Test caption',
      carousel: 'Test carousel',
      reel: 'Test reel',
    })
    const result = deserializeMultiFormat(json)

    expect(result.caption).toBe('Test caption')
    expect(result.carousel).toBe('Test carousel')
    expect(result.reel).toBe('Test reel')
  })

  it('parses partial JSON', () => {
    const json = JSON.stringify({ caption: 'Only caption' })
    const result = deserializeMultiFormat(json)

    expect(result.caption).toBe('Only caption')
    expect(result.carousel).toBeUndefined()
  })

  it('falls back to plain text as caption for backwards compatibility', () => {
    const plainText = 'This is just a regular caption without JSON'
    const result = deserializeMultiFormat(plainText)

    expect(result.caption).toBe(plainText)
    expect(result.carousel).toBeUndefined()
    expect(result.reel).toBeUndefined()
  })

  it('handles invalid JSON gracefully', () => {
    const invalid = '{ invalid json }'
    const result = deserializeMultiFormat(invalid)

    expect(result.caption).toBe(invalid)
  })

  it('handles JSON array as plain text fallback', () => {
    const array = '["not", "an", "object"]'
    const result = deserializeMultiFormat(array)

    expect(result.caption).toBe(array)
  })

  it('handles null JSON as plain text fallback', () => {
    const nullJson = 'null'
    const result = deserializeMultiFormat(nullJson)

    expect(result.caption).toBe(nullJson)
  })
})
