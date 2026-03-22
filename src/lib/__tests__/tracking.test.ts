import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockSelect, mockCreateClient } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import {
  trackContentEvent,
  trackGeneration,
  trackCopy,
  trackConfirmed,
  trackSkipped,
  trackRefinement,
  getFrameworkUsage,
} from '../tracking'

describe('tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockReturnValue({ error: null })
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => ({
        insert: mockInsert,
        select: mockSelect,
      })),
    })
  })

  describe('trackContentEvent', () => {
    it('inserts event into content_interactions', async () => {
      await trackContentEvent({
        coach_id: 'coach-123',
        content_id: 'content-456',
        event_type: 'generated',
        metadata: { framework_id: 'client_win' },
      })

      expect(mockInsert).toHaveBeenCalledWith({
        coach_id: 'coach-123',
        content_id: 'content-456',
        event_type: 'generated',
        metadata: { framework_id: 'client_win' },
      })
    })

    it('handles null content_id', async () => {
      await trackContentEvent({
        coach_id: 'coach-123',
        event_type: 'skipped',
      })

      expect(mockInsert).toHaveBeenCalledWith({
        coach_id: 'coach-123',
        content_id: null,
        event_type: 'skipped',
        metadata: {},
      })
    })

    it('does not throw on insert error', async () => {
      const errorInsert = vi.fn().mockReturnValue({ error: { message: 'DB error', code: '500' } })
      mockCreateClient.mockResolvedValue({
        from: vi.fn(() => ({
          insert: errorInsert,
        })),
      })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Should not throw
      await expect(
        trackContentEvent({
          coach_id: 'coach-123',
          event_type: 'generated',
        })
      ).resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('does not throw on unexpected exception', async () => {
      mockCreateClient.mockRejectedValue(new Error('Connection failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        trackContentEvent({
          coach_id: 'coach-123',
          event_type: 'generated',
        })
      ).resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('trackGeneration', () => {
    it('calls trackContentEvent with generation metadata', async () => {
      await trackGeneration('coach-123', 'content-456', {
        framework_id: 'educational_carousel',
        source: 'chat',
        input_tokens: 100,
        output_tokens: 200,
        model: 'claude-sonnet-4-20250514',
      })

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          coach_id: 'coach-123',
          content_id: 'content-456',
          event_type: 'generated',
          metadata: expect.objectContaining({
            framework_id: 'educational_carousel',
            source: 'chat',
            input_tokens: 100,
            output_tokens: 200,
          }),
        })
      )
    })
  })

  describe('trackCopy', () => {
    it('tracks copy event with format', async () => {
      await trackCopy('coach-123', 'content-456', 'carousel')

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'copied',
          metadata: { format_copied: 'carousel' },
        })
      )
    })

    it('defaults to caption format', async () => {
      await trackCopy('coach-123', 'content-456')

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { format_copied: 'caption' },
        })
      )
    })
  })

  describe('trackConfirmed', () => {
    it('tracks confirmation event', async () => {
      await trackConfirmed('coach-123', 'content-456')

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'confirmed',
        })
      )
    })
  })

  describe('trackSkipped', () => {
    it('tracks skip event', async () => {
      await trackSkipped('coach-123', 'content-456')

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'skipped',
        })
      )
    })
  })

  describe('trackRefinement', () => {
    it('tracks refinement with type', async () => {
      await trackRefinement('coach-123', 'content-456', 'shorter')

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'refinement',
          metadata: { refinement_type: 'shorter' },
        })
      )
    })
  })

  describe('getFrameworkUsage', () => {
    it('returns framework usage counts', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              data: [
                { metadata: { framework_id: 'client_win' } },
                { metadata: { framework_id: 'client_win' } },
                { metadata: { framework_id: 'myth_buster' } },
              ],
              error: null,
            }),
          }),
        }),
      })

      const usage = await getFrameworkUsage('coach-123')

      expect(usage).toEqual({
        client_win: 2,
        myth_buster: 1,
      })
    })

    it('returns empty object on error', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Error' },
            }),
          }),
        }),
      })

      const usage = await getFrameworkUsage('coach-123')

      expect(usage).toEqual({})
    })
  })
})
