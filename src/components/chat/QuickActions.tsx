'use client'

import { Sparkles, Calendar, PlusCircle } from 'lucide-react'

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
  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            onClick={() => onAction(action.prompt)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <Icon className="w-4 h-4" />
            {action.label}
          </button>
        )
      })}
    </div>
  )
}
