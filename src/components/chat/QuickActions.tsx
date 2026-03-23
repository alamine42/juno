'use client'

import { Sparkles, Calendar, PlusCircle } from 'lucide-react'
import { useArrowNavigation } from '@/lib/hooks'

interface QuickActionsProps {
  onAction: (prompt: string) => void
  disabled?: boolean
}

const QUICK_ACTIONS = [
  {
    label: 'What to post today?',
    prompt: 'What should I post on Instagram today? Give me a ready-to-use caption.',
    icon: Sparkles,
  },
  {
    label: 'Plan My Week',
    prompt: 'Help me plan my Instagram content for the next 7 days. What should I post each day?',
    icon: Calendar,
  },
  {
    label: 'New Content',
    prompt: 'I want to create new content. What would resonate with my audience right now?',
    icon: PlusCircle,
  },
]

export function QuickActions({ onAction, disabled = false }: QuickActionsProps) {
  const { containerRef, handleKeyDown } = useArrowNavigation({
    direction: 'horizontal',
    loop: true,
  })

  return (
    <div className="px-4 sm:px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
      <p id="quick-actions-label" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Quick Actions
      </p>

      <div
        ref={containerRef}
        role="toolbar"
        aria-labelledby="quick-actions-label"
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3"
      >
        {QUICK_ACTIONS.map((action, index) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              onClick={() => onAction(action.prompt)}
              disabled={disabled}
              tabIndex={index === 0 ? 0 : -1}
              className="group relative overflow-hidden px-4 py-3 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:border-green-400 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-2 justify-center">
                <Icon className="w-4 h-4 text-gray-500 group-hover:text-green-600 transition-colors" aria-hidden="true" />
                <span>{action.label}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
