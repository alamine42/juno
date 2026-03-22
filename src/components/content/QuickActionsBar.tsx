'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Sparkles, PenLine, Calendar, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { FRAMEWORKS } from '@/lib/frameworks'

interface QuickActionsBarProps {
  onSuggestion?: () => void
  onFrameworkSelect?: (frameworkId: string) => void
  onBatchCreate?: () => void
  disabled?: boolean
  className?: string
}

export function QuickActionsBar({
  onSuggestion,
  onFrameworkSelect,
  onBatchCreate,
  disabled = false,
  className = '',
}: QuickActionsBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeftArrow(scrollLeft > 10)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
  }, [])

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [checkScroll])

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = direction === 'left' ? -200 : 200
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
  }, [])

  return (
    <div className={`relative group ${className}`}>
      {/* Left scroll button */}
      <button
        onClick={() => scroll('left')}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all duration-200 ${
          showLeftArrow ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
        }`}
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-4 scroll-smooth"
      >
        {/* Primary CTA - What should I post? */}
        {onSuggestion && (
          <button
            onClick={onSuggestion}
            disabled={disabled}
            className="flex-shrink-0 inline-flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            <Sparkles className="w-4 h-4" />
            What should I post?
          </button>
        )}

        {/* Plan Week */}
        {onBatchCreate && (
          <button
            onClick={onBatchCreate}
            disabled={disabled}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <Calendar className="w-4 h-4" />
            Plan Week
          </button>
        )}

        {/* Framework shortcuts */}
        {onFrameworkSelect && (
          <>
            {FRAMEWORKS.slice(0, 3).map((framework) => (
              <button
                key={framework.id}
                onClick={() => onFrameworkSelect(framework.id)}
                disabled={disabled}
                className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                <FileText className="w-4 h-4" />
                {framework.name}
              </button>
            ))}

            {/* Freeform */}
            <button
              onClick={() => onFrameworkSelect('freeform')}
              disabled={disabled}
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
            >
              <PenLine className="w-4 h-4" />
              Freeform
            </button>
          </>
        )}
      </div>

      {/* Right scroll button */}
      <button
        onClick={() => scroll('right')}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all duration-200 ${
          showRightArrow ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
        }`}
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Gradient fades */}
      <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent pointer-events-none transition-opacity duration-200 ${showLeftArrow ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none transition-opacity duration-200 ${showRightArrow ? 'opacity-100' : 'opacity-0'}`} />

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
