'use client'

import { useEffect, useCallback } from 'react'
import { X, FileText, Sparkles, MessageCircle, Camera, Zap, PenLine } from 'lucide-react'
import { FRAMEWORKS, type Framework } from '@/lib/frameworks'
import { useFocusTrap } from '@/lib/hooks'

// Framework icons mapping
const FRAMEWORK_ICONS: Record<string, React.ReactNode> = {
  client_win: <Sparkles className="w-5 h-5 text-yellow-500" />,
  educational_carousel: <FileText className="w-5 h-5 text-blue-500" />,
  engagement_hook: <MessageCircle className="w-5 h-5 text-purple-500" />,
  behind_the_scenes: <Camera className="w-5 h-5 text-pink-500" />,
  myth_buster: <Zap className="w-5 h-5 text-orange-500" />,
  freeform: <PenLine className="w-5 h-5 text-green-500" />,
}

// Freeform option (not a real framework)
const FREEFORM_OPTION = {
  id: 'freeform',
  name: 'Freeform',
  description: 'Write anything you want',
  output_type: 'caption' as const,
}

interface FrameworkPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (framework: Framework | null) => void // null = freeform
}

export function FrameworkPicker({ isOpen, onClose, onSelect }: FrameworkPickerProps) {
  const focusTrapRef = useFocusTrap(isOpen)

  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  const allOptions = [...FRAMEWORKS, FREEFORM_OPTION]

  function handleSelect(option: typeof allOptions[number]) {
    if (option.id === 'freeform') {
      onSelect(null)
    } else {
      onSelect(option as Framework)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet (mobile) / Modal (desktop) */}
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        className="fixed z-50 bg-white rounded-t-2xl lg:rounded-2xl shadow-xl
          inset-x-0 bottom-0 max-h-[85vh] overflow-hidden
          lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
          lg:w-full lg:max-w-lg lg:max-h-[600px]
          animate-slide-up lg:animate-fade-in"
      >
        {/* Drag handle (mobile only) */}
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 id="picker-title" className="text-lg font-semibold text-gray-900">
            Choose a format
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Framework list */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] lg:max-h-[calc(600px-80px)] p-4">
          <div className="space-y-2">
            {allOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option)}
                className="w-full flex items-start gap-3 p-4 rounded-xl border border-gray-200
                  hover:border-green-300 hover:bg-green-50/50 transition-all duration-150
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2
                  text-left group"
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-white
                  flex items-center justify-center transition-colors">
                  {FRAMEWORK_ICONS[option.id] || <FileText className="w-5 h-5 text-gray-400" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{option.name}</span>
                    {option.output_type === 'carousel_script' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        Carousel
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">
                    {option.description}
                  </p>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-gray-300 group-hover:text-green-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translate(-50%, -48%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .lg\\:animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        @media (min-width: 1024px) {
          .animate-slide-up {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}
