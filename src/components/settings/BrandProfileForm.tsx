'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, AlertCircle, X } from 'lucide-react'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { type BrandProfile } from '@/lib/db/schema'

interface BrandProfileFormProps {
  initialProfile: BrandProfile | null
  onSave?: () => void
}

interface FormData {
  targetAudience: string
  styleWords: string
  tone: string
  emojiUsage: string
  signOff: string
  avoidedTopics: string
  avoidedWords: string
  preferredWords: string
}

const TONES = ['Motivational', 'Educational', 'Casual', 'Professional', 'Raw'] as const
const EMOJI_OPTIONS = ['Never', 'Sparingly', 'Frequently', 'Heavily'] as const

function parseArrayToString(arr: string[] | null | undefined): string {
  if (!arr) return ''
  return arr.join(', ')
}

function parseStringToArray(str: string): string[] {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function BrandProfileForm({ initialProfile, onSave }: BrandProfileFormProps) {
  const [formData, setFormData] = useState<FormData>({
    targetAudience: initialProfile?.targetAudience || '',
    styleWords: initialProfile?.styleWords || '',
    tone: initialProfile?.tone || '',
    emojiUsage: initialProfile?.emojiUsage || '',
    signOff: initialProfile?.signOff || '',
    avoidedTopics: parseArrayToString(initialProfile?.avoidedTopics),
    avoidedWords: parseArrayToString(initialProfile?.avoidedWords),
    preferredWords: parseArrayToString(initialProfile?.preferredWords),
  })

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const debounceRef = useRef<NodeJS.Timeout>()
  const hasLoadedRef = useRef(false)

  // Sync form data when initialProfile changes (async load from parent)
  useEffect(() => {
    if (initialProfile && !hasLoadedRef.current) {
      setFormData({
        targetAudience: initialProfile.targetAudience || '',
        styleWords: initialProfile.styleWords || '',
        tone: initialProfile.tone || '',
        emojiUsage: initialProfile.emojiUsage || '',
        signOff: initialProfile.signOff || '',
        avoidedTopics: parseArrayToString(initialProfile.avoidedTopics),
        avoidedWords: parseArrayToString(initialProfile.avoidedWords),
        preferredWords: parseArrayToString(initialProfile.preferredWords),
      })
      hasLoadedRef.current = true
    }
  }, [initialProfile])

  // Clear status after a delay
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timeout = setTimeout(() => setSaveStatus('idle'), 3000)
      return () => clearTimeout(timeout)
    }
  }, [saveStatus])

  const save = useCallback(async (data: FormData) => {
    setSaveStatus('saving')
    setErrorMessage('')

    try {
      const payload: Record<string, unknown> = {
        target_audience: data.targetAudience.trim() || null,
        style_words: data.styleWords.trim() || null,
        tone: data.tone.toLowerCase() || null,
        emoji_usage: data.emojiUsage.toLowerCase() || null,
        sign_off: data.signOff.trim() || null,
        avoided_topics: parseStringToArray(data.avoidedTopics),
        avoided_words: parseStringToArray(data.avoidedWords),
        preferred_words: parseStringToArray(data.preferredWords),
      }

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save')
      }

      setSaveStatus('saved')
      onSave?.()
    } catch (err) {
      setSaveStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save')
    }
  }, [onSave])

  const debouncedSave = useCallback(
    (data: FormData) => {
      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      // Debounce save
      debounceRef.current = setTimeout(() => {
        save(data)
      }, 1000)
    },
    [save]
  )

  const handleFieldChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value }
        debouncedSave(updated)
        return updated
      })
    },
    [debouncedSave]
  )

  const handleBlur = useCallback(() => {
    // Immediate save on blur
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    save(formData)
  }, [formData, save])

  return (
    <div className="space-y-6">
      {/* Save status indicator */}
      <div className="flex items-center justify-end h-6">
        {saveStatus === 'saving' && (
          <span className="text-sm text-gray-500 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
            Saving...
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-sm text-green-600 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            Saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {errorMessage}
          </span>
        )}
      </div>

      {/* Target Audience */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Target Audience
        </label>
        <Textarea
          value={formData.targetAudience}
          onChange={(e) => handleFieldChange('targetAudience', e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g., Busy professionals who want to build healthy habits without spending hours at the gym"
          rows={3}
          className="w-full"
        />
        <p className="mt-1 text-xs text-gray-500">
          Describe your ideal client in one or two sentences
        </p>
      </div>

      {/* Style Words */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Style Words
        </label>
        <Input
          value={formData.styleWords}
          onChange={(e) => handleFieldChange('styleWords', e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g., energetic, no-BS, supportive"
        />
        <p className="mt-1 text-xs text-gray-500">
          3-5 words that describe your coaching style
        </p>
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Tone
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TONES.map((tone) => {
            const isSelected = formData.tone.toLowerCase() === tone.toLowerCase()
            return (
              <button
                key={tone}
                type="button"
                onClick={() => {
                  handleFieldChange('tone', tone)
                  save({ ...formData, tone })
                }}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                  isSelected
                    ? 'border-green-500 bg-green-50 text-green-900'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {tone}
              </button>
            )
          })}
        </div>
      </div>

      {/* Emoji Usage */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Emoji Usage
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EMOJI_OPTIONS.map((option) => {
            const isSelected = formData.emojiUsage.toLowerCase() === option.toLowerCase()
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  handleFieldChange('emojiUsage', option)
                  save({ ...formData, emojiUsage: option })
                }}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                  isSelected
                    ? 'border-green-500 bg-green-50 text-green-900'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sign Off */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Sign Off
        </label>
        <Input
          value={formData.signOff}
          onChange={(e) => handleFieldChange('signOff', e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g., Let's go! 💪"
        />
        <p className="mt-1 text-xs text-gray-500">
          How you typically end your posts
        </p>
      </div>

      {/* Preferred Words */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Preferred Words
        </label>
        <Input
          value={formData.preferredWords}
          onChange={(e) => handleFieldChange('preferredWords', e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g., transform, unleash, crush it"
        />
        <p className="mt-1 text-xs text-gray-500">
          Words or phrases you love to use (comma-separated)
        </p>
      </div>

      {/* Avoided Words */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Avoided Words
        </label>
        <Input
          value={formData.avoidedWords}
          onChange={(e) => handleFieldChange('avoidedWords', e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g., just, very, amazing"
        />
        <p className="mt-1 text-xs text-gray-500">
          Words or phrases you never want to use (comma-separated)
        </p>
      </div>

      {/* Avoided Topics */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Avoided Topics
        </label>
        <Textarea
          value={formData.avoidedTopics}
          onChange={(e) => handleFieldChange('avoidedTopics', e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g., politics, competitor brands, specific diets"
          rows={2}
        />
        <p className="mt-1 text-xs text-gray-500">
          Topics you never want to discuss (comma-separated)
        </p>
      </div>
    </div>
  )
}
