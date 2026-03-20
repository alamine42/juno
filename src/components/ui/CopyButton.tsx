'use client'

import { useState, useCallback } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label = 'Copy to clipboard', className = '' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'fallback'>('idle')

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('fallback')
      setTimeout(() => setState('idle'), 4000)
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 ${
        state === 'copied'
          ? 'bg-green-50 text-green-700'
          : 'border border-gray-300 text-gray-700 hover:border-gray-400'
      } ${className}`}
    >
      {state === 'idle' && (
        <>
          <ClipboardIcon />
          Copy
        </>
      )}
      {state === 'copied' && (
        <>
          <CheckIcon />
          Copied!
        </>
      )}
      {state === 'fallback' && (
        <span className="text-xs">Select text manually to copy</span>
      )}
    </button>
  )
}

function ClipboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
