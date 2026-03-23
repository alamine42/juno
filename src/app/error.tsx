'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console (would go to monitoring service in production)
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md text-center" role="alert" aria-live="assertive">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          We hit an unexpected error. This has been logged and we&apos;re looking into it.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            variant="secondary"
            className="inline-flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Try Again
          </Button>
          <Link href="/chat" className="inline-flex">
            <Button className="w-full inline-flex items-center justify-center">
              <MessageCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Back to Chat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
