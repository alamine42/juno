'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Calendar, ChevronRight, ChevronLeft, Check, AlertCircle, Loader2, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FrameworkPicker } from '@/components/frameworks/FrameworkPicker'
import { FRAMEWORKS, type Framework } from '@/lib/frameworks'
import { useFocusTrap } from '@/lib/hooks'

interface BatchDay {
  day: string
  dayLabel: string
  framework: Framework | null
  topic: string
}

interface BatchModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (batchId: string, count: number) => void
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon', fullLabel: 'Monday' },
  { value: 'tuesday', label: 'Tue', fullLabel: 'Tuesday' },
  { value: 'wednesday', label: 'Wed', fullLabel: 'Wednesday' },
  { value: 'thursday', label: 'Thu', fullLabel: 'Thursday' },
  { value: 'friday', label: 'Fri', fullLabel: 'Friday' },
  { value: 'saturday', label: 'Sat', fullLabel: 'Saturday' },
  { value: 'sunday', label: 'Sun', fullLabel: 'Sunday' },
] as const

type BatchStatus = 'selecting' | 'configuring' | 'generating' | 'complete' | 'error'

export function BatchModal({ isOpen, onClose, onComplete }: BatchModalProps) {
  const [status, setStatus] = useState<BatchStatus>('selecting')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [batchDays, setBatchDays] = useState<BatchDay[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [focusTopic, setFocusTopic] = useState('')
  const [showFrameworkPicker, setShowFrameworkPicker] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const focusTrapRef = useFocusTrap(isOpen && !showFrameworkPicker)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus('selecting')
      setSelectedDays([])
      setBatchDays([])
      setCurrentStep(0)
      setFocusTopic('')
      setError('')
      setProgress({ current: 0, total: 0 })
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && status !== 'generating') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, status])

  const toggleDay = useCallback((day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
    setError('')
  }, [])

  const handleDaysConfirm = useCallback(() => {
    if (selectedDays.length === 0) {
      setError('Please select at least one day')
      return
    }

    const sortedDays = DAYS_OF_WEEK.filter((d) => selectedDays.includes(d.value))
    const days: BatchDay[] = sortedDays.map((d, index) => ({
      day: d.value,
      dayLabel: d.fullLabel,
      framework: FRAMEWORKS[index % FRAMEWORKS.length],
      topic: '',
    }))

    setBatchDays(days)
    setStatus('configuring')
    setCurrentStep(0)
    setError('')
  }, [selectedDays])

  const handleFrameworkSelect = useCallback(
    (framework: Framework | null) => {
      setBatchDays((prev) => {
        const updated = [...prev]
        updated[currentStep] = {
          ...updated[currentStep],
          framework: framework || FRAMEWORKS[0],
        }
        return updated
      })
      setShowFrameworkPicker(false)
    },
    [currentStep]
  )

  const handleTopicChange = useCallback(
    (topic: string) => {
      setBatchDays((prev) => {
        const updated = [...prev]
        updated[currentStep] = { ...updated[currentStep], topic }
        return updated
      })
    },
    [currentStep]
  )

  const handleNext = useCallback(() => {
    if (currentStep < batchDays.length - 1) {
      setCurrentStep((s) => s + 1)
    }
  }, [currentStep, batchDays.length])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    } else {
      setStatus('selecting')
    }
  }, [currentStep])

  const handleGenerate = useCallback(async () => {
    setStatus('generating')
    setError('')
    setProgress({ current: 0, total: batchDays.length })

    try {
      const response = await fetch('/api/content/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus_topic: focusTopic || 'fitness and wellness content',
          posting_days: batchDays.map((d) => d.day),
          promotion_text: undefined,
          // Include per-day customizations for the API to use
          day_configs: batchDays.map((d) => ({
            day: d.day,
            framework_id: d.framework?.id || null,
            topic: d.topic || null,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate batch')
      }

      setStatus('complete')
      setProgress({ current: data.generated, total: batchDays.length })
      onComplete(data.batchId, data.generated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }, [batchDays, focusTopic, onComplete])

  if (!isOpen) return null

  const currentDay = batchDays[currentStep]

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={status !== 'generating' ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-title"
        className="fixed z-50 bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden
          inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto max-h-[90vh]
          sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full
          animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header with gradient */}
        <div className="relative px-6 pt-6 pb-4 border-b border-gray-100">
          {/* Decorative gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-2xl" />

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 id="batch-title" className="text-lg font-bold text-gray-900">
                  Plan Your Week
                </h2>
                <p className="text-sm text-gray-500">
                  {status === 'selecting' && 'Select your posting days'}
                  {status === 'configuring' && `Customize day ${currentStep + 1} of ${batchDays.length}`}
                  {status === 'generating' && 'Creating your content...'}
                  {status === 'complete' && 'All done!'}
                  {status === 'error' && 'Something went wrong'}
                </p>
              </div>
            </div>
            {status !== 'generating' && (
              <button
                onClick={onClose}
                className="p-2 -mr-2 -mt-1 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Day Selection */}
          {status === 'selecting' && (
            <div className="space-y-5">
              {/* Focus topic input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What's your focus this week?
                </label>
                <input
                  type="text"
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  placeholder="e.g., Summer fitness goals, mindset coaching"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Day selector - Calendar style */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select posting days
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = selectedDays.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          isSelected
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <span className="text-xs opacity-70">{day.label}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 mt-0.5" />
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  {selectedDays.length === 0 ? 'No days selected' : `${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''} selected`}
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Day Configuration */}
          {status === 'configuring' && currentDay && (
            <div className="space-y-5">
              {/* Progress indicator - Dots style */}
              <div className="flex items-center justify-center gap-2">
                {batchDays.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      i === currentStep
                        ? 'bg-emerald-500 scale-125'
                        : i < currentStep
                          ? 'bg-emerald-300'
                          : 'bg-gray-200'
                    }`}
                    aria-label={`Go to day ${i + 1}`}
                  />
                ))}
              </div>

              {/* Day badge */}
              <div className="text-center">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold border border-emerald-200">
                  <Calendar className="w-4 h-4" />
                  {currentDay.dayLabel}
                </span>
              </div>

              {/* Framework selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Content format
                </label>
                <button
                  onClick={() => setShowFrameworkPicker(true)}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-left flex items-center justify-between hover:border-emerald-300 hover:bg-emerald-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-gray-900">
                        {currentDay.framework?.name || 'Select format'}
                      </span>
                      {currentDay.framework && (
                        <span className="text-xs text-gray-500">{currentDay.framework.description}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Topic input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Specific topic <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={currentDay.topic}
                  onChange={(e) => handleTopicChange(e.target.value)}
                  placeholder="e.g., Morning routine tips"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          )}

          {/* Generating state */}
          {status === 'generating' && (
            <div className="text-center py-10">
              <div className="relative inline-flex">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-bold text-gray-900">
                Creating your content
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Generating {batchDays.length} posts tailored to your style
              </p>

              {/* Progress dots */}
              <div className="mt-6 flex justify-center gap-2">
                {batchDays.map((day, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                    <span className="text-[10px] font-medium text-gray-400">{day.dayLabel.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete state */}
          {status === 'complete' && (
            <div className="text-center py-10">
              <div className="inline-flex w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center shadow-xl shadow-emerald-500/30">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-gray-900">
                Content created!
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {progress.current} posts are ready in your Drafts
              </p>
              <div className="mt-6">
                <Button onClick={onClose} className="px-8">
                  View Drafts
                </Button>
              </div>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="text-center py-10">
              <div className="inline-flex w-20 h-20 rounded-2xl bg-red-100 items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-gray-900">
                Something went wrong
              </h3>
              <p className="mt-1 text-sm text-red-600">{error}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={() => setStatus('configuring')}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Navigation buttons */}
        {(status === 'selecting' || status === 'configuring') && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            {status === 'configuring' ? (
              <>
                <Button variant="ghost" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                {currentStep < batchDays.length - 1 ? (
                  <Button onClick={handleNext}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleGenerate} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Generate All
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDaysConfirm}
                  disabled={selectedDays.length === 0}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
          </div>
        )}

        {/* Framework Picker */}
        <FrameworkPicker
          isOpen={showFrameworkPicker}
          onClose={() => setShowFrameworkPicker(false)}
          onSelect={handleFrameworkSelect}
        />
      </div>
    </>
  )
}
