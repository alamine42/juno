'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TONES = ['Motivational', 'Educational', 'Casual', 'Professional', 'Raw'] as const
const EMOJI_OPTIONS = ['Never', 'Sparingly', 'Frequently', 'Heavily'] as const

interface ProfileData {
  style_words: string
  tone: string
  emoji_usage: string
  sign_off: string
  avoided_topics: string
  // Optional
  example_posts: string
  preferred_words: string
  avoided_words: string
  target_audience: string
}

const INITIAL_DATA: ProfileData = {
  style_words: '',
  tone: '',
  emoji_usage: '',
  sign_off: '',
  avoided_topics: '',
  example_posts: '',
  preferred_words: '',
  avoided_words: '',
  target_audience: '',
}

const STEPS = [
  {
    key: 'style_words' as const,
    question: 'How would you describe your coaching style in 3 words?',
    placeholder: 'e.g., energetic, no-BS, supportive',
    type: 'text' as const,
    required: true,
  },
  {
    key: 'tone' as const,
    question: 'What tone do you use with your audience?',
    type: 'select' as const,
    options: TONES,
    required: true,
  },
  {
    key: 'emoji_usage' as const,
    question: 'Do you use emojis in your posts?',
    type: 'select' as const,
    options: EMOJI_OPTIONS,
    required: true,
  },
  {
    key: 'sign_off' as const,
    question: 'How do you typically end your posts?',
    placeholder: 'e.g., "Let\'s go! 💪", "DM me to chat"',
    type: 'text' as const,
    required: true,
  },
  {
    key: 'avoided_topics' as const,
    question: 'What topics do you NEVER want to discuss?',
    placeholder: 'e.g., politics, competitor brands, specific diets',
    type: 'text' as const,
    required: true,
  },
  {
    key: 'optional' as const,
    question: 'Optional: Help Juno nail your voice even better',
    type: 'optional' as const,
    required: false,
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<ProfileData>(INITIAL_DATA)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const currentStep = STEPS[step]
  const isLastStep = step === STEPS.length - 1

  function updateField(key: keyof ProfileData, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  function handleNext() {
    if (currentStep.required && currentStep.type !== 'optional') {
      const value = data[currentStep.key as keyof ProfileData]
      if (!value.trim()) {
        setError('This field is required')
        return
      }
    }
    setError('')
    setStep((s) => s + 1)
  }

  function handleBack() {
    setError('')
    setStep((s) => Math.max(0, s - 1))
  }

  async function handleSkip() {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skip: true }),
    })
    router.push('/chat')
  }

  async function handleFinish() {
    setSaving(true)

    // Parse comma-separated strings into arrays
    const parseList = (s: string) =>
      s.split(',').map((x) => x.trim()).filter(Boolean)

    // Parse example posts by double-newline
    const parseExamples = (s: string) =>
      s.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)

    const payload: Record<string, unknown> = {
      style_words: data.style_words.trim(),
      tone: data.tone.toLowerCase(),
      emoji_usage: data.emoji_usage.toLowerCase(),
      sign_off: data.sign_off.trim(),
      avoided_topics: parseList(data.avoided_topics),
    }

    // Optional fields
    if (data.target_audience.trim()) {
      payload.target_audience = data.target_audience.trim()
    }
    if (data.preferred_words.trim()) {
      payload.preferred_words = parseList(data.preferred_words)
    }
    if (data.avoided_words.trim()) {
      payload.avoided_words = parseList(data.avoided_words)
    }
    if (data.example_posts.trim()) {
      payload.example_posts = parseExamples(data.example_posts)
    }

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      setSaving(false)
      setError('Failed to save. Please try again.')
      return
    }

    router.push('/chat')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-1">
            Step {step + 1} of {STEPS.length}
          </p>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-green-600 h-1.5 rounded-full transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <h2 className="text-xl font-semibold mb-6">{currentStep.question}</h2>

        {/* Input area */}
        {currentStep.type === 'text' && (
          <input
            type="text"
            value={data[currentStep.key as keyof ProfileData]}
            onChange={(e) => updateField(currentStep.key as keyof ProfileData, e.target.value)}
            placeholder={currentStep.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleNext() }}
          />
        )}

        {currentStep.type === 'select' && (
          <div className="grid grid-cols-1 gap-3">
            {currentStep.options!.map((option) => {
              const selected = data[currentStep.key as keyof ProfileData] === option
              return (
                <button
                  key={option}
                  onClick={() => updateField(currentStep.key as keyof ProfileData, option)}
                  className={`px-4 py-3 rounded-lg border text-left text-lg transition ${
                    selected
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        )}

        {currentStep.type === 'optional' && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your target audience in one sentence
              </label>
              <input
                type="text"
                value={data.target_audience}
                onChange={(e) => updateField('target_audience', e.target.value)}
                placeholder="e.g., Busy moms who want to get strong"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Words or phrases you love to use
              </label>
              <input
                type="text"
                value={data.preferred_words}
                onChange={(e) => updateField('preferred_words', e.target.value)}
                placeholder="e.g., transform, unleash, crush it"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Words or phrases you avoid
              </label>
              <input
                type="text"
                value={data.avoided_words}
                onChange={(e) => updateField('avoided_words', e.target.value)}
                placeholder="e.g., just, very, amazing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Paste 1-3 of your best Instagram captions
              </label>
              <textarea
                value={data.example_posts}
                onChange={(e) => updateField('example_posts', e.target.value)}
                placeholder="Paste captions here, separated by a blank line..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 mt-3" role="alert">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <div>
            {step > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              disabled={saving}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition"
            >
              Skip for now
            </button>
            {isLastStep ? (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Finish'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
