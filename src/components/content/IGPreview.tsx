'use client'

import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react'

interface IGPreviewProps {
  caption: string
  username?: string
  avatarUrl?: string
  className?: string
  showPlaceholder?: boolean
}

const MAX_CAPTION_LENGTH = 2200

function highlightHashtags(text: string): React.ReactNode[] {
  const parts = text.split(/(#\w+)/g)

  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      return (
        <span key={index} className="text-[#00376b] hover:text-[#00376b]/80 cursor-pointer">
          {part}
        </span>
      )
    }
    return part
  })
}

export function IGPreview({
  caption,
  username = 'your_handle',
  avatarUrl,
  className = '',
  showPlaceholder = true,
}: IGPreviewProps) {
  const characterCount = caption.length
  const isOverLimit = characterCount > MAX_CAPTION_LENGTH
  const percentUsed = Math.min((characterCount / MAX_CAPTION_LENGTH) * 100, 100)

  return (
    <div className={`bg-white rounded-3xl shadow-2xl shadow-black/10 overflow-hidden border border-gray-100 ${className}`}>
      {/* IG Header - Pixel perfect recreation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Story ring gradient */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
              <div className="w-full h-full rounded-full bg-white p-[2px]">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-gray-600">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-gray-900 leading-tight">
              {username}
            </span>
            <span className="text-xs text-gray-500">Original audio</span>
          </div>
        </div>
        <button className="p-2 -mr-2 text-gray-900 hover:text-gray-600 transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* IG Image Placeholder - 1:1 aspect ratio */}
      {showPlaceholder && (
        <div className="aspect-square bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 relative overflow-hidden">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />
          {/* Center icon */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-lg shadow-gray-200/50 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-400">Your image here</span>
          </div>
        </div>
      )}

      {/* Action buttons - Exact IG styling */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="group p-0.5 -ml-0.5">
              <Heart className="w-6 h-6 text-gray-900 group-hover:text-gray-600 transition-colors group-active:scale-90" />
            </button>
            <button className="group p-0.5">
              <MessageCircle className="w-6 h-6 text-gray-900 group-hover:text-gray-600 transition-colors group-active:scale-90 -scale-x-100" />
            </button>
            <button className="group p-0.5">
              <Send className="w-6 h-6 text-gray-900 group-hover:text-gray-600 transition-colors group-active:scale-90 -rotate-12" />
            </button>
          </div>
          <button className="group p-0.5 -mr-0.5">
            <Bookmark className="w-6 h-6 text-gray-900 group-hover:text-gray-600 transition-colors group-active:scale-90" />
          </button>
        </div>

        {/* Likes */}
        <div className="mt-3 mb-2">
          <span className="text-sm font-semibold text-gray-900">1,234 likes</span>
        </div>
      </div>

      {/* Caption with proper IG formatting */}
      <div className="px-4 pb-3">
        <p className="text-sm text-gray-900 leading-[1.4] whitespace-pre-wrap">
          <span className="font-semibold">{username}</span>{' '}
          {highlightHashtags(caption)}
        </p>
      </div>

      {/* Timestamp */}
      <div className="px-4 pb-4">
        <span className="text-[10px] font-normal text-gray-400 uppercase tracking-wide">
          Just now
        </span>
      </div>

      {/* Character count bar */}
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">Character count</span>
          <span className={`text-xs font-semibold tabular-nums ${isOverLimit ? 'text-red-600' : 'text-gray-600'}`}>
            {characterCount.toLocaleString()} / {MAX_CAPTION_LENGTH.toLocaleString()}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOverLimit
                ? 'bg-red-500'
                : percentUsed > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        {isOverLimit && (
          <p className="mt-2 text-xs text-red-600 font-medium">
            Caption exceeds Instagram's character limit
          </p>
        )}
      </div>
    </div>
  )
}
