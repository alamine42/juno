import { describe, it, expect } from 'vitest'
import { moderateContent, isContentBlocked, getBlocklist } from '../moderation'

describe('moderation', () => {
  describe('moderateContent', () => {
    describe('green (safe) content', () => {
      it('returns green for normal fitness content', () => {
        const result = moderateContent(
          'Start your day with 10 minutes of stretching. Your body will thank you! Ready to feel amazing?'
        )
        expect(result.rating).toBe('green')
        expect(result.reasons).toHaveLength(0)
      })

      it('returns green for motivational content', () => {
        const result = moderateContent(
          'Progress is not always linear. Some days you crush it, some days you just show up. Both count. Keep going, you are doing better than you think!'
        )
        expect(result.rating).toBe('green')
        expect(result.reasons).toHaveLength(0)
      })

      it('returns green for content exactly at minimum length', () => {
        const result = moderateContent('A'.repeat(50))
        expect(result.rating).toBe('green')
      })

      it('returns green for content exactly at maximum length', () => {
        const result = moderateContent('A'.repeat(2200))
        expect(result.rating).toBe('green')
      })
    })

    describe('yellow (needs review) content', () => {
      it('returns yellow for empty content', () => {
        const result = moderateContent('')
        expect(result.rating).toBe('yellow')
        expect(result.reasons).toContain('Content is empty')
      })

      it('returns yellow for whitespace-only content', () => {
        const result = moderateContent('   \n\t   ')
        expect(result.rating).toBe('yellow')
        expect(result.reasons).toContain('Content is empty')
      })

      it('returns yellow for too short content', () => {
        const result = moderateContent('Just do it!')
        expect(result.rating).toBe('yellow')
        expect(result.reasons[0]).toContain('too short')
      })

      it('returns yellow for content under 50 chars', () => {
        const result = moderateContent('A'.repeat(49))
        expect(result.rating).toBe('yellow')
        expect(result.reasons[0]).toContain('too short')
      })

      it('returns yellow for too long content', () => {
        const result = moderateContent('A'.repeat(2201))
        expect(result.rating).toBe('yellow')
        expect(result.reasons[0]).toContain('exceeds Instagram limit')
      })

      it('returns yellow for hedging phrases', () => {
        const result = moderateContent(
          'I think this workout might work for some people. Maybe you should probably try it if you want.'
        )
        expect(result.rating).toBe('yellow')
        expect(result.reasons[0]).toContain('hedging phrases')
      })

      it('returns yellow for multiple hedging phrases', () => {
        const result = moderateContent(
          'I think this could potentially work. Maybe it is worth trying, probably. Some people say it helps.'
        )
        expect(result.rating).toBe('yellow')
        expect(result.reasons[0]).toContain('hedging phrases')
      })

      it('accumulates multiple yellow reasons', () => {
        const result = moderateContent('I think maybe.')
        expect(result.rating).toBe('yellow')
        expect(result.reasons.length).toBeGreaterThanOrEqual(2)
      })
    })

    describe('red (blocked) content', () => {
      it('returns red for medical cure claims', () => {
        const result = moderateContent(
          'This supplement will cure all your health problems and treat disease effectively!'
        )
        expect(result.rating).toBe('red')
        expect(result.reasons[0]).toContain('blocked terms')
        expect(result.reasons[0]).toContain('cure')
      })

      it('returns red for guaranteed weight loss', () => {
        const result = moderateContent(
          'Our program offers guaranteed weight loss. You will lose 20 pounds in one week!'
        )
        expect(result.rating).toBe('red')
        expect(result.reasons[0]).toContain('guaranteed weight loss')
      })

      it('returns red for FDA claims', () => {
        const result = moderateContent(
          'This product is FDA approved for maximum results and safety.'
        )
        expect(result.rating).toBe('red')
        expect(result.reasons[0]).toContain('fda approved')
      })

      it('returns red for steroid references', () => {
        const result = moderateContent(
          'Get anabolic results with our pharmaceutical grade supplements!'
        )
        expect(result.rating).toBe('red')
        expect(result.reasons[0]).toContain('blocked terms')
      })

      it('returns red for miracle claims', () => {
        const result = moderateContent(
          'Our miracle formula with secret formula ingredients will change your life forever!'
        )
        expect(result.rating).toBe('red')
        expect(result.reasons[0]).toContain('blocked terms')
      })

      it('returns red immediately without checking yellow flags', () => {
        // Short content with blocklist term - should be red, not yellow
        const result = moderateContent('This cure works')
        expect(result.rating).toBe('red')
        expect(result.reasons).toHaveLength(1)
      })

      it('is case-insensitive for blocklist', () => {
        const result = moderateContent('This CURE will TREAT DISEASE and provide GUARANTEED WEIGHT LOSS')
        expect(result.rating).toBe('red')
      })
    })
  })

  describe('isContentBlocked', () => {
    it('returns true for red content', () => {
      expect(isContentBlocked('This cure will treat disease')).toBe(true)
    })

    it('returns false for green content', () => {
      expect(isContentBlocked('Start your fitness journey today with a simple morning routine!')).toBe(false)
    })

    it('returns false for yellow content', () => {
      expect(isContentBlocked('I think maybe this works')).toBe(false)
    })
  })

  describe('getBlocklist', () => {
    it('returns the blocklist array', () => {
      const blocklist = getBlocklist()
      expect(Array.isArray(blocklist)).toBe(true)
      expect(blocklist.length).toBeGreaterThan(0)
      expect(blocklist).toContain('cure')
      expect(blocklist).toContain('miracle')
    })

    it('returns a readonly array', () => {
      const blocklist = getBlocklist()
      // TypeScript should prevent modification, but we can check it's the same reference
      expect(blocklist).toBe(getBlocklist())
    })
  })
})
