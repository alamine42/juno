'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * Global error boundary for root layout errors.
 * This catches errors that the regular error.tsx can't handle.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console (would go to monitoring service in production)
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md text-center" role="alert" aria-live="assertive">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6">
              A critical error occurred. Please try refreshing the page.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border-2 border-gray-200 text-gray-700 font-medium hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Try Again
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
