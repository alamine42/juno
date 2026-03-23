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
      role="listitem"
      aria-label={`${isUser ? 'Your message' : 'Juno message'}${isLoading ? ', loading' : ''}`}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}
    >
      {/* Juno Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3 mt-0.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white text-sm font-bold shadow-sm">
            J
          </span>
        </div>
      )}

      <div
        className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] ${
          isUser
            ? 'bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl rounded-tr-md shadow-md'
            : 'bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm hover:shadow-md transition-shadow duration-200'
        } px-4 py-3`}
      >
        {isLoading ? (
          <LoadingDots />
        ) : (
          <>
            <p className={`${isUser ? 'text-white' : 'text-gray-900'} whitespace-pre-wrap break-words text-[15px] leading-[1.6]`}>
              {message.content}
            </p>

            {/* Actions for assistant messages */}
            {!isUser && message.content && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                <CopyButton text={message.content} className="text-xs" />
                {onSaveDraft && !message.contentId && (
                  <button
                    onClick={() => onSaveDraft(message.content)}
                    aria-label="Save this response as a draft"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-green-200 text-green-700 hover:bg-green-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                  >
                    <SaveIcon />
                    Save as Draft
                  </button>
                )}
                {message.contentId && (
                  <span className="text-xs text-green-600 font-semibold flex items-center gap-1.5">
                    <CheckIcon />
                    Saved
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
    <div className="flex items-center space-x-1.5 py-2">
      <span className="w-2.5 h-2.5 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full animate-pulse" style={{ animationDuration: '0.8s' }} />
      <span className="w-2.5 h-2.5 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full animate-pulse" style={{ animationDelay: '150ms', animationDuration: '0.8s' }} />
      <span className="w-2.5 h-2.5 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full animate-pulse" style={{ animationDelay: '300ms', animationDuration: '0.8s' }} />
      <span className="ml-2 text-xs text-gray-400">Thinking...</span>
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

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
