'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { MoreVertical, Copy, Trash2, Edit3, Clock, Check, ExternalLink } from 'lucide-react'
import { type Content } from '@/types/database'
import { getFrameworkById } from '@/lib/frameworks'

type ContentStatus = 'draft' | 'reminder_set' | 'posted'

interface ContentCardProps {
  content: Content
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onCopy?: (id: string) => void
  onSetReminder?: (id: string) => void
}

const STATUS_STYLES: Record<ContentStatus, { bg: string; text: string; border: string; label: string; dot: string }> = {
  draft: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    label: 'Draft',
    dot: 'bg-slate-400'
  },
  reminder_set: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    label: 'Scheduled',
    dot: 'bg-blue-500'
  },
  posted: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    label: 'Posted',
    dot: 'bg-emerald-500'
  },
}

function truncateText(text: string, maxLines: number = 3): string {
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null) {
      text = parsed.caption || parsed.carousel || parsed.reel || text
    }
  } catch {
    // Plain text, use as-is
  }

  const lines = text.split('\n')
  if (lines.length <= maxLines) return text

  return lines.slice(0, maxLines).join('\n') + '...'
}

export function ContentCard({
  content,
  onEdit,
  onDelete,
  onCopy,
  onSetReminder,
}: ContentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [isHovered, setIsHovered] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const status = content.status as ContentStatus
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.draft
  const framework = content.framework_id ? getFrameworkById(content.framework_id) : null
  const preview = truncateText(content.body)

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleCopy = useCallback(async () => {
    let textToCopy = content.body
    try {
      const parsed = JSON.parse(content.body)
      if (typeof parsed === 'object' && parsed !== null) {
        textToCopy = parsed.caption || parsed.carousel || parsed.reel || content.body
      }
    } catch {
      // Plain text
    }

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
      onCopy?.(content.id)
    } catch {
      // Fallback
    }
    setMenuOpen(false)
  }, [content.body, content.id, onCopy])

  const handleEdit = useCallback(() => {
    onEdit?.(content.id)
    setMenuOpen(false)
  }, [content.id, onEdit])

  const handleDelete = useCallback(() => {
    onDelete?.(content.id)
    setMenuOpen(false)
  }, [content.id, onDelete])

  const handleSetReminder = useCallback(() => {
    onSetReminder?.(content.id)
    setMenuOpen(false)
  }, [content.id, onSetReminder])

  return (
    <div
      className={`group relative bg-white rounded-2xl border transition-all duration-300 ease-out
        ${isHovered ? 'border-gray-300 shadow-lg shadow-gray-200/50 -translate-y-0.5' : 'border-gray-200 shadow-sm'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient accent line */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status badge with dot indicator */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
              {statusStyle.label}
            </span>

            {/* Framework pill */}
            {framework && (
              <span className="px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 rounded-full">
                {framework.name}
              </span>
            )}
          </div>

          {/* Actions menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500
                ${menuOpen
                  ? 'bg-gray-100 text-gray-700'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }
              `}
              aria-label="Content actions"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-30 bg-white rounded-xl border border-gray-200 shadow-xl shadow-gray-200/50 py-1.5 min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-200"
                role="menu"
              >
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  role="menuitem"
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-gray-400" />
                      <span>Copy text</span>
                    </>
                  )}
                </button>

                {onEdit && (
                  <button
                    onClick={handleEdit}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    role="menuitem"
                  >
                    <Edit3 className="w-4 h-4 text-gray-400" />
                    <span>Edit content</span>
                  </button>
                )}

                {onSetReminder && status === 'draft' && (
                  <button
                    onClick={handleSetReminder}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    role="menuitem"
                  >
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>Set reminder</span>
                  </button>
                )}

                {onDelete && (
                  <>
                    <div className="my-1.5 mx-3 border-t border-gray-100" />
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      role="menuitem"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview with better typography */}
        <p className="text-sm text-gray-700 leading-relaxed line-clamp-3 whitespace-pre-wrap font-normal">
          {preview}
        </p>

        {/* Footer with improved layout */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">
            {new Date(content.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: content.created_at.slice(0, 4) !== new Date().getFullYear().toString() ? 'numeric' : undefined,
            })}
          </span>

          {content.reminder_at && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              {new Date(content.reminder_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>

      {/* Quick action on hover - desktop only */}
      <div className={`hidden sm:flex absolute bottom-5 right-5 gap-1.5 transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}>
        <button
          onClick={handleCopy}
          className="p-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-sm"
          aria-label="Quick copy"
        >
          {copyState === 'copied' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}
