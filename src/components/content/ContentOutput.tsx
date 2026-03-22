'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, Hash, Sparkles, ArrowDownToLine, ArrowUpToLine, Coffee, Briefcase, Flame } from 'lucide-react'
import { deserializeMultiFormat, type MultiFormatContent } from '@/lib/ai/claude'

type FormatTab = 'caption' | 'carousel' | 'reel'
type RefinementType = 'shorter' | 'longer' | 'casual' | 'professional' | 'spicy'

interface ContentOutputProps {
  body: string
  contentId?: string
  onRefinement?: (type: RefinementType, currentContent: string) => void
  onCopy?: (format: FormatTab) => void
  className?: string
}

const FORMAT_LABELS: Record<FormatTab, { label: string; description: string }> = {
  caption: { label: 'Caption', description: 'Feed post' },
  carousel: { label: 'Carousel', description: 'Multi-slide' },
  reel: { label: 'Reel', description: 'Short video' },
}

const REFINEMENTS: { type: RefinementType; label: string; icon: typeof Sparkles; description: string }[] = [
  { type: 'shorter', label: 'Shorter', icon: ArrowDownToLine, description: 'More concise' },
  { type: 'longer', label: 'Longer', icon: ArrowUpToLine, description: 'Add detail' },
  { type: 'casual', label: 'Casual', icon: Coffee, description: 'Relaxed tone' },
  { type: 'professional', label: 'Professional', icon: Briefcase, description: 'Formal tone' },
  { type: 'spicy', label: 'Spicy', icon: Flame, description: 'Bold & edgy' },
]

export function ContentOutput({
  body,
  contentId,
  onRefinement,
  onCopy,
  className = '',
}: ContentOutputProps) {
  const [activeTab, setActiveTab] = useState<FormatTab>('caption')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [showHashtags, setShowHashtags] = useState(true)
  const [isRefining, setIsRefining] = useState(false)
  const [activeRefinement, setActiveRefinement] = useState<RefinementType | null>(null)

  const formats = deserializeMultiFormat(body)
  const availableTabs = (Object.keys(formats) as FormatTab[]).filter(
    (key) => formats[key] && formats[key]!.trim().length > 0
  )

  const currentTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'caption'
  const currentContent = formats[currentTab] || ''

  const displayContent = showHashtags
    ? currentContent
    : currentContent.replace(/#\w+\s*/g, '').trim()

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayContent)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
      onCopy?.(currentTab)
    } catch {
      // Fallback
    }
  }, [displayContent, currentTab, onCopy])

  const handleRefinement = useCallback(
    async (type: RefinementType) => {
      if (!onRefinement || isRefining) return

      setIsRefining(true)
      setActiveRefinement(type)
      try {
        await onRefinement(type, currentContent)
      } finally {
        setIsRefining(false)
        setActiveRefinement(null)
      }
    },
    [currentContent, onRefinement, isRefining]
  )

  const renderContent = (text: string): React.ReactNode[] => {
    const parts = text.split(/(#\w+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-blue-600 hover:text-blue-700 cursor-default">
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {/* Format tabs - Segmented control style */}
      {availableTabs.length > 1 && (
        <div className="p-3 bg-gray-50 border-b border-gray-100">
          <div className="inline-flex p-1 bg-gray-200/60 rounded-xl">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                  currentTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="relative z-10">{FORMAT_LABELS[tab].label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="p-5">
        {/* Content display with elegant styling */}
        <div className="relative group">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 min-h-[140px] max-h-[320px] overflow-y-auto border border-gray-100">
            <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap font-normal">
              {showHashtags ? renderContent(currentContent) : displayContent}
            </p>
          </div>

          {/* Quick copy button overlay - appears on hover */}
          <button
            onClick={handleCopy}
            className={`absolute top-3 right-3 p-2 rounded-lg transition-all duration-200 ${
              copyState === 'copied'
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100'
            }`}
            aria-label="Copy content"
          >
            {copyState === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Controls row */}
        <div className="mt-4 flex items-center justify-between">
          {/* Hashtag toggle - Pill switch style */}
          <button
            onClick={() => setShowHashtags(!showHashtags)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              showHashtags
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            {showHashtags ? 'Hashtags visible' : 'Hashtags hidden'}
          </button>

          {/* Character count */}
          <span className="text-xs font-medium text-gray-400 tabular-nums">
            {displayContent.length.toLocaleString()} characters
          </span>
        </div>

        {/* Quick refinement buttons - Enhanced with icons */}
        {onRefinement && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-semibold text-gray-700">Quick refinements</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {REFINEMENTS.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => handleRefinement(type)}
                  disabled={isRefining}
                  className={`group relative inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    activeRefinement === type
                      ? 'bg-violet-100 border-violet-300 text-violet-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700'
                  } ${isRefining && activeRefinement !== type ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={description}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-200 ${activeRefinement === type ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Primary copy button */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              copyState === 'copied'
                ? 'bg-emerald-100 text-emerald-700 focus-visible:ring-emerald-500'
                : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98] focus-visible:ring-gray-900'
            }`}
          >
            {copyState === 'copied' ? (
              <>
                <Check className="w-4 h-4" />
                Copied to clipboard
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy {FORMAT_LABELS[currentTab].label}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
