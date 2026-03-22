import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}))

import { suggestContent, getVarietyScore } from '../suggestions'
import { FRAMEWORKS } from '../frameworks'

describe('suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupMocks(options: {
    contentData?: { framework_id: string }[]
    brandProfile?: { target_audience?: string; style_words?: string } | null
  }) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'content') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({
                  data: options.contentData ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'brand_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: options.brandProfile ?? null,
                error: options.brandProfile === null ? { code: 'PGRST116' } : null,
              }),
            }),
          }),
        }
      }
      return {}
    })
  }

  describe('suggestContent', () => {
    it('returns a framework suggestion', async () => {
      setupMocks({
        contentData: [],
        brandProfile: { target_audience: 'busy professionals', style_words: 'energetic' },
      })

      const suggestion = await suggestContent('coach-123')

      expect(suggestion.framework).toBeDefined()
      expect(suggestion.framework.id).toBeDefined()
      expect(suggestion.suggestedTopic).toBeDefined()
      expect(suggestion.reason).toBeDefined()
    })

    it('suggests least-used framework', async () => {
      setupMocks({
        contentData: [
          { framework_id: 'client_win' },
          { framework_id: 'client_win' },
          { framework_id: 'educational_carousel' },
          { framework_id: 'educational_carousel' },
          { framework_id: 'engagement_hook' },
        ],
        brandProfile: null,
      })

      const suggestion = await suggestContent('coach-123')

      // behind_the_scenes and myth_buster have 0 usage, should suggest one of them
      expect(['behind_the_scenes', 'myth_buster']).toContain(suggestion.framework.id)
    })

    it('handles no previous content', async () => {
      setupMocks({
        contentData: [],
        brandProfile: null,
      })

      const suggestion = await suggestContent('coach-123')

      // Should suggest first framework by display_order when all have 0 usage
      expect(suggestion.framework).toBeDefined()
      expect(suggestion.reason).toContain("haven't used")
    })

    it('includes reason based on usage count', async () => {
      setupMocks({
        contentData: [{ framework_id: 'myth_buster' }],
        brandProfile: null,
      })

      const suggestion = await suggestContent('coach-123')

      // Should suggest an unused framework
      expect(suggestion.framework.id).not.toBe('myth_buster')
      expect(suggestion.reason).toContain("haven't used")
    })

    it('generates topic based on framework type', async () => {
      setupMocks({
        contentData: [],
        brandProfile: { target_audience: 'fitness enthusiasts' },
      })

      const suggestion = await suggestContent('coach-123')

      // Topic should be non-empty string
      expect(suggestion.suggestedTopic.length).toBeGreaterThan(10)
    })
  })

  describe('getVarietyScore', () => {
    it('returns 0 for no content', async () => {
      setupMocks({ contentData: [] })

      const score = await getVarietyScore('coach-123')

      expect(score).toBe(0)
    })

    it('returns high score for evenly distributed content', async () => {
      // One post per framework = perfect distribution
      setupMocks({
        contentData: FRAMEWORKS.map((fw) => ({ framework_id: fw.id })),
      })

      const score = await getVarietyScore('coach-123')

      expect(score).toBeGreaterThan(80)
    })

    it('returns lower score for skewed distribution', async () => {
      // All posts in one framework
      setupMocks({
        contentData: [
          { framework_id: 'client_win' },
          { framework_id: 'client_win' },
          { framework_id: 'client_win' },
          { framework_id: 'client_win' },
          { framework_id: 'client_win' },
        ],
      })

      const score = await getVarietyScore('coach-123')

      expect(score).toBeLessThan(50)
    })

    it('returns score between 0 and 100', async () => {
      setupMocks({
        contentData: [
          { framework_id: 'client_win' },
          { framework_id: 'educational_carousel' },
        ],
      })

      const score = await getVarietyScore('coach-123')

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })
})
