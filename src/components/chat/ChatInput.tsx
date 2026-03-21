'use client'

import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setMessage('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [message, disabled, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }

  const isMessageEmpty = !message.trim()

  return (
    <div className="flex flex-col gap-2 p-4 sm:p-5 bg-white border-t border-gray-100 shadow-lg shadow-gray-900/5">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent focus:shadow-lg focus:shadow-green-500/10 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-150 placeholder:text-gray-400"
          style={{ minHeight: '48px', maxHeight: '150px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || isMessageEmpty}
          aria-label="Send message"
          title={isMessageEmpty ? 'Type a message to send' : 'Send message (Enter)'}
          className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all duration-150 shadow-md hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 active:scale-95"
        >
          <Send className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Keyboard hint for desktop */}
      <p className="hidden sm:block text-xs text-gray-400">
        Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 font-mono text-xs">Shift + Enter</kbd> for newline
      </p>
    </div>
  )
}
