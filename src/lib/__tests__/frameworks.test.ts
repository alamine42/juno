import { describe, it, expect } from 'vitest'
import {
  FRAMEWORKS,
  getFrameworkById,
  getAllFrameworks,
  validateFrameworkAnswers,
  buildFrameworkPrompt,
  getFrameworkIds,
} from '../frameworks'

describe('frameworks', () => {
  describe('FRAMEWORKS constant', () => {
    it('has 5 frameworks', () => {
      expect(FRAMEWORKS).toHaveLength(5)
    })

    it('has all required framework IDs', () => {
      const ids = FRAMEWORKS.map(f => f.id)
      expect(ids).toContain('client_win')
      expect(ids).toContain('educational_carousel')
      expect(ids).toContain('engagement_hook')
      expect(ids).toContain('behind_the_scenes')
      expect(ids).toContain('myth_buster')
    })

    it('each framework has required properties', () => {
      FRAMEWORKS.forEach(framework => {
        expect(framework).toHaveProperty('id')
        expect(framework).toHaveProperty('name')
        expect(framework).toHaveProperty('description')
        expect(framework).toHaveProperty('output_type')
        expect(framework).toHaveProperty('questions')
        expect(framework).toHaveProperty('prompt_template')
        expect(framework).toHaveProperty('display_order')
      })
    })

    it('all frameworks have questions array', () => {
      FRAMEWORKS.forEach(framework => {
        expect(Array.isArray(framework.questions)).toBe(true)
        expect(framework.questions.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getFrameworkById', () => {
    it('returns framework for valid ID', () => {
      const framework = getFrameworkById('client_win')
      expect(framework).toBeDefined()
      expect(framework?.name).toBe('Client Win Story')
    })

    it('returns undefined for invalid ID', () => {
      const framework = getFrameworkById('nonexistent')
      expect(framework).toBeUndefined()
    })

    it('returns correct framework for each ID', () => {
      expect(getFrameworkById('educational_carousel')?.name).toBe('Educational Carousel')
      expect(getFrameworkById('engagement_hook')?.name).toBe('Engagement Hook')
      expect(getFrameworkById('behind_the_scenes')?.name).toBe('Behind the Scenes')
      expect(getFrameworkById('myth_buster')?.name).toBe('Myth Buster')
    })
  })

  describe('getAllFrameworks', () => {
    it('returns all frameworks sorted by display_order', () => {
      const frameworks = getAllFrameworks()
      expect(frameworks).toHaveLength(5)

      // Check they're sorted
      for (let i = 1; i < frameworks.length; i++) {
        expect(frameworks[i].display_order).toBeGreaterThanOrEqual(frameworks[i-1].display_order)
      }
    })

    it('returns a new array (not mutating original)', () => {
      const frameworks1 = getAllFrameworks()
      const frameworks2 = getAllFrameworks()
      expect(frameworks1).not.toBe(frameworks2)
    })
  })

  describe('validateFrameworkAnswers', () => {
    it('returns empty array when all required answers provided', () => {
      const missing = validateFrameworkAnswers('client_win', {
        client_name: 'Sarah',
        achievement: 'Lost 20 lbs',
        obstacle: 'Busy schedule',
        timeframe: '3 months',
        lesson: 'Consistency is key',
      })
      expect(missing).toHaveLength(0)
    })

    it('returns missing keys for empty answers', () => {
      const missing = validateFrameworkAnswers('client_win', {})
      expect(missing).toContain('client_name')
      expect(missing).toContain('achievement')
      expect(missing).toContain('obstacle')
      expect(missing).toContain('timeframe')
      expect(missing).toContain('lesson')
    })

    it('returns missing keys for partial answers', () => {
      const missing = validateFrameworkAnswers('client_win', {
        client_name: 'Sarah',
        achievement: 'Lost weight',
      })
      expect(missing).toContain('obstacle')
      expect(missing).toContain('timeframe')
      expect(missing).toContain('lesson')
      expect(missing).not.toContain('client_name')
      expect(missing).not.toContain('achievement')
    })

    it('treats whitespace-only as missing', () => {
      const missing = validateFrameworkAnswers('client_win', {
        client_name: '   ',
        achievement: '',
        obstacle: '\t\n',
        timeframe: '3 months',
        lesson: 'Be consistent',
      })
      expect(missing).toContain('client_name')
      expect(missing).toContain('achievement')
      expect(missing).toContain('obstacle')
      expect(missing).not.toContain('timeframe')
    })

    it('returns framework_not_found for invalid framework', () => {
      const missing = validateFrameworkAnswers('invalid_framework', { foo: 'bar' })
      expect(missing).toContain('framework_not_found')
    })

    it('works for engagement_hook with select question', () => {
      const missing = validateFrameworkAnswers('engagement_hook', {
        take_or_myth: 'Cardio is the best for weight loss',
        engagement_type: 'Their opinion',
      })
      expect(missing).toHaveLength(0)
    })
  })

  describe('buildFrameworkPrompt', () => {
    it('returns null for invalid framework', () => {
      const prompt = buildFrameworkPrompt('nonexistent', { foo: 'bar' })
      expect(prompt).toBeNull()
    })

    it('replaces placeholders with answers', () => {
      const prompt = buildFrameworkPrompt('client_win', {
        client_name: 'Sarah',
        achievement: 'lost 20 pounds',
        obstacle: 'busy work schedule',
        timeframe: '3 months',
        lesson: 'consistency beats perfection',
      })

      expect(prompt).not.toBeNull()
      expect(prompt).toContain('Sarah')
      expect(prompt).toContain('lost 20 pounds')
      expect(prompt).toContain('busy work schedule')
      expect(prompt).toContain('3 months')
      expect(prompt).toContain('consistency beats perfection')
    })

    it('replaces all occurrences of placeholders', () => {
      // Build a prompt and check original placeholder is gone
      const prompt = buildFrameworkPrompt('client_win', {
        client_name: 'John',
        achievement: 'gained muscle',
        obstacle: 'lack of time',
        timeframe: '6 months',
        lesson: 'prioritize yourself',
      })

      expect(prompt).not.toContain('{{client_name}}')
      expect(prompt).not.toContain('{{achievement}}')
    })

    it('escapes XML-like tags in answers', () => {
      const prompt = buildFrameworkPrompt('client_win', {
        client_name: '<script>alert("xss")</script>',
        achievement: 'test',
        obstacle: 'test',
        timeframe: 'test',
        lesson: 'test',
      })

      expect(prompt).not.toContain('<script>')
      expect(prompt).toContain('&lt;script&gt;')
    })

    it('escapes nested placeholder injection attempts', () => {
      const prompt = buildFrameworkPrompt('client_win', {
        client_name: '{{achievement}}',
        achievement: 'real achievement',
        obstacle: 'test',
        timeframe: 'test',
        lesson: 'test',
      })

      // The {{achievement}} should be escaped, not resolved
      expect(prompt).toContain('{ {achievement} }')
    })

    it('ignores extra answers not in template', () => {
      const prompt = buildFrameworkPrompt('engagement_hook', {
        take_or_myth: 'Cardio myth',
        engagement_type: 'Their opinion',
        extra_field: 'Should be ignored',
      })

      expect(prompt).not.toBeNull()
      expect(prompt).toContain('Cardio myth')
      expect(prompt).not.toContain('Should be ignored')
    })

    it('works with educational_carousel template', () => {
      const prompt = buildFrameworkPrompt('educational_carousel', {
        topic: 'protein intake',
        audience: 'beginners',
        mistake: 'not eating enough',
        unique_take: 'focus on timing',
      })

      expect(prompt).toContain('protein intake')
      expect(prompt).toContain('beginners')
      expect(prompt).toContain('Slide 1')
    })

    it('works with behind_the_scenes template', () => {
      const prompt = buildFrameworkPrompt('behind_the_scenes', {
        activity: 'meal prepping',
        why_it_matters: 'saves time',
        insight: 'batch cooking is key',
      })

      expect(prompt).toContain('meal prepping')
      expect(prompt).toContain('saves time')
    })

    it('works with myth_buster template', () => {
      const prompt = buildFrameworkPrompt('myth_buster', {
        myth: 'carbs are bad',
        why_believed: 'diet culture',
        truth: 'carbs are energy',
        action: 'eat balanced',
      })

      expect(prompt).toContain('carbs are bad')
      expect(prompt).toContain('diet culture')
    })
  })

  describe('getFrameworkIds', () => {
    it('returns array of all framework IDs', () => {
      const ids = getFrameworkIds()
      expect(ids).toHaveLength(5)
      expect(ids).toContain('client_win')
      expect(ids).toContain('educational_carousel')
      expect(ids).toContain('engagement_hook')
      expect(ids).toContain('behind_the_scenes')
      expect(ids).toContain('myth_buster')
    })
  })
})
