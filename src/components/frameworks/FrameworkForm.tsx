'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Framework, FrameworkQuestion } from '@/lib/frameworks'

interface FrameworkFormProps {
  framework: Framework
  onSubmit: (answers: Record<string, string>) => void
  onCancel: () => void
  isSubmitting?: boolean
}

const MAX_ANSWER_LENGTH = 500

export function FrameworkForm({ framework, onSubmit, onCancel, isSubmitting = false }: FrameworkFormProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  // Reset state when framework changes
  useEffect(() => {
    setStep(0)
    setAnswers({})
    setError('')
  }, [framework.id])

  const questions = framework.questions
  const currentQuestion = questions[step]
  const isLastStep = step === questions.length - 1
  const progress = ((step + 1) / questions.length) * 100

  function updateAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  function handleNext() {
    if (isSubmitting) return

    const value = answers[currentQuestion.key]?.trim()
    if (!value) {
      setError('This field is required')
      return
    }
    if (value.length > MAX_ANSWER_LENGTH) {
      setError(`Answer too long. Maximum ${MAX_ANSWER_LENGTH} characters.`)
      return
    }
    setError('')

    // Trim answers before submission to enforce length limits
    const trimmedAnswers = Object.fromEntries(
      Object.entries(answers).map(([k, v]) => [k, v.trim()])
    )

    if (isLastStep) {
      onSubmit(trimmedAnswers)
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleBack() {
    setError('')
    if (step === 0) {
      onCancel()
    } else {
      setStep((s) => s - 1)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleNext()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={step === 0 ? 'Cancel' : 'Back'}
          >
            {step === 0 ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div>
            <h2 className="font-semibold text-gray-900">{framework.name}</h2>
            <p className="text-xs text-gray-500">
              Step {step + 1} of {questions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 bg-gray-100"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-label={`Question ${step + 1} of ${questions.length}`}
      >
        <div
          className="h-full bg-green-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto">
          <QuestionInput
            question={currentQuestion}
            value={answers[currentQuestion.key] || ''}
            onChange={(value) => updateAnswer(currentQuestion.key, value)}
            onKeyDown={handleKeyDown}
            error={error}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-3 p-4 border-t border-gray-100 bg-white">
        <Button
          variant="secondary"
          onClick={handleBack}
          className="flex-1"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button
          variant="primary"
          onClick={handleNext}
          className="flex-1"
          disabled={isSubmitting}
          loading={isSubmitting && isLastStep}
        >
          {isLastStep ? 'Generate' : 'Next'}
          {!isLastStep && <ArrowRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </div>
  )
}

interface QuestionInputProps {
  question: FrameworkQuestion
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  error?: string
}

function QuestionInput({ question, value, onChange, onKeyDown, error }: QuestionInputProps) {
  if (question.type === 'select' && question.options) {
    return (
      <div>
        <label className="block text-lg font-medium text-gray-900 mb-4">
          {question.question}
        </label>
        <div className="grid grid-cols-1 gap-2">
          {question.options.map((option) => (
            <button
              key={option}
              onClick={() => onChange(option)}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2
                ${value === option
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50 text-gray-700'
                }`}
            >
              <span className="font-medium">{option}</span>
            </button>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  // Default: text input
  return (
    <div>
      <label className="block text-lg font-medium text-gray-900 mb-4">
        {question.question}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type your answer..."
        error={error}
        autoFocus
      />
      <p className="mt-2 text-sm text-gray-500">
        Press Enter to continue
      </p>
    </div>
  )
}
