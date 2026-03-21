'use client'

import { CopyButton } from '@/components/ui/CopyButton'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  contentId?: string
  isLoading?: boolean
}

interface MessageBubbleProps {
  message: Message
  onSaveDraft?: (content: string) => void
}

export function MessageBubble({ message, onSaveDraft }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isLoading = message.isLoading

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      {/* Juno Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 text-sm font-bold">
            J
          </span>
        </div>
      )}

      <div
        className={`max-w-[80%] ${
          isUser
            ? 'bg-green-50 border border-green-200 rounded-2xl rounded-tr-md'
            : 'bg-gray-100 border border-gray-200 rounded-2xl rounded-tl-md'
        } px-4 py-3`}
      >
        {isLoading ? (
          <LoadingDots />
        ) : (
          <>
            <p className="text-gray-900 whitespace-pre-wrap break-words">
              {message.content}
            </p>

            {/* Actions for assistant messages */}
            {!isUser && message.content && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                <CopyButton text={message.content} className="text-xs" />
                {onSaveDraft && !message.contentId && (
                  <button
                    onClick={() => onSaveDraft(message.content)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <SaveIcon />
                    Save as Draft
                  </button>
                )}
                {message.contentId && (
                  <span className="text-xs text-green-600 font-medium">
                    Saved as draft
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex space-x-1 py-2">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

function SaveIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  )
}
