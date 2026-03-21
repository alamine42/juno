'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Heart, MessageCircle, Send } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

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

type ViewState = 'form' | 'generating' | 'preview'

const SAMPLE_PROMPT = 'Write a short Instagram post that shows off my coaching style. Make it authentic and ready to post.'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<ProfileData>(INITIAL_DATA)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewState, setViewState] = useState<ViewState>('form')
  const [samplePost, setSamplePost] = useState('')
  const [generateError, setGenerateError] = useState('')

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
    setError('')

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

    // Show the "wow moment" - generate a sample post
    setViewState('generating')
    await generateSamplePost()
  }

  async function generateSamplePost() {
    setGenerateError('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: SAMPLE_PROMPT }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate sample')
      }

      setSamplePost(data.message)
      setViewState('preview')
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong')
      // Still show preview but with error
      setViewState('preview')
    }
  }

  function handleYes() {
    router.push('/chat')
  }

  function handleNotQuite() {
    // Go back to the beginning of the form to edit
    setViewState('form')
    setSaving(false)
    setStep(0)
    setSamplePost('')
    setGenerateError('')
  }

  // Generating state
  if (viewState === 'generating') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-green-50 to-white">
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <LoadingSpinner size="lg" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Let me show you something...
          </h2>
          <p className="text-base text-gray-600 mb-1">
            Creating a sample post in your voice
          </p>
          <p className="text-sm text-gray-500">
            This should take about 10 seconds
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-6">
            <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" />
            <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </main>
    )
  }

  // Preview state - the "wow moment"
  if (viewState === 'preview') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6">
            Here's a sample post in your voice
          </h2>

          {/* Instagram mockup */}
          <InstagramPreview content={samplePost} error={generateError} />

          <h3 className="text-xl font-semibold text-center mt-8 mb-4">
            Sound like you?
          </h3>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleYes}
              disabled={!samplePost}
              className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white text-lg font-semibold rounded-2xl hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              ✨ Yes, let's go!
            </button>
            <button
              onClick={handleNotQuite}
              className="w-full px-6 py-4 border-2 border-gray-300 text-gray-700 text-lg font-semibold rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
            >
              Not quite - let me update my profile
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Form state
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600">
              Step {step + 1} of {STEPS.length}
            </p>
            <p className="text-xs text-gray-400">
              {Math.round(((step + 1) / STEPS.length) * 100)}%
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 via-green-600 to-green-500 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <h2 className="text-2xl font-bold mb-6">{currentStep.question}</h2>

        {/* Input area */}
        {currentStep.type === 'text' && (
          <div>
            <input
              type="text"
              value={data[currentStep.key as keyof ProfileData]}
              onChange={(e) => updateField(currentStep.key as keyof ProfileData, e.target.value)}
              placeholder={currentStep.placeholder}
              className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-medium placeholder:text-gray-400 transition-all duration-200"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleNext() }}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5" role="alert">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>
        )}

        {currentStep.type === 'select' && (
          <div className="grid grid-cols-1 gap-3">
            {currentStep.options!.map((option) => {
              const selected = data[currentStep.key as keyof ProfileData] === option
              return (
                <button
                  key={option}
                  onClick={() => updateField(currentStep.key as keyof ProfileData, option)}
                  className={`px-5 py-4 rounded-2xl border-2 text-left text-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                    selected
                      ? 'border-green-500 bg-green-50 text-green-900 shadow-md shadow-green-500/20'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your target audience in one sentence
              </label>
              <input
                type="text"
                value={data.target_audience}
                onChange={(e) => updateField('target_audience', e.target.value)}
                placeholder="e.g., Busy moms who want to get strong"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Words or phrases you love to use
              </label>
              <input
                type="text"
                value={data.preferred_words}
                onChange={(e) => updateField('preferred_words', e.target.value)}
                placeholder="e.g., transform, unleash, crush it"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Words or phrases you avoid
              </label>
              <input
                type="text"
                value={data.avoided_words}
                onChange={(e) => updateField('avoided_words', e.target.value)}
                placeholder="e.g., just, very, amazing"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste 1-3 of your best Instagram captions
              </label>
              <textarea
                value={data.example_posts}
                onChange={(e) => updateField('example_posts', e.target.value)}
                placeholder="Paste captions here, separated by a blank line..."
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>
        )}

        {/* Error for non-text steps */}
        {error && currentStep.type !== 'text' && (
          <p className="text-sm text-red-600 mt-3 flex items-center gap-1.5" role="alert">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <div>
            {step > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 rounded-lg"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              disabled={saving}
              className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 rounded-lg"
            >
              Skip for now
            </button>
            {isLastStep ? (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 font-semibold shadow-md hover:shadow-lg active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                {saving ? 'Saving...' : 'Finish'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
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

function InstagramPreview({ content, error }: { content: string; error?: string }) {
  if (error) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-3xl p-8 text-center shadow-lg">
        <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <p className="text-lg font-semibold text-red-900 mb-2">Couldn't generate sample</p>
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-gray-300 rounded-3xl shadow-2xl overflow-hidden">
      {/* IG Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5 shadow-sm">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <span className="text-xs font-bold text-gray-700">You</span>
          </div>
        </div>
        <div>
          <span className="font-semibold text-sm text-gray-900">your_handle</span>
          <p className="text-xs text-gray-500">Fitness Coach</p>
        </div>
      </div>

      {/* IG Image Placeholder */}
      <div className="aspect-square bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
        <span className="text-gray-400 text-sm font-medium relative">Your image here</span>
      </div>

      {/* IG Caption */}
      <div className="px-4 py-3.5">
        <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
          <span className="font-semibold text-gray-900">your_handle</span>
          {' '}
          {content}
        </p>

        {/* Like/comment hints */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-gray-500">
          <Heart className="w-5 h-5" />
          <MessageCircle className="w-5 h-5" />
          <Send className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
