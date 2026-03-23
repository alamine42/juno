'use client'

import { AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorMessageProps {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
  className?: string
}

/**
 * Inline error message component with optional dismiss and retry actions.
 * Uses ARIA live regions for accessibility.
 */
export function ErrorMessage({ message, onDismiss, onRetry, className }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 p-4 bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200',
        className
      )}
    >
      <AlertCircle
        className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-800">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
          >
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded p-1 -m-1"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
