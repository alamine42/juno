'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Clock, AlertCircle, Calendar, Bell } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ReminderModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (datetime: Date) => void
  initialDate?: Date
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatTimeForInput(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

// Quick select options
const QUICK_OPTIONS = [
  { label: 'Tomorrow 9am', getValue: () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d
  }},
  { label: 'Tomorrow 12pm', getValue: () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(12, 0, 0, 0)
    return d
  }},
  { label: 'Tomorrow 6pm', getValue: () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(18, 0, 0, 0)
    return d
  }},
  { label: 'In 3 days', getValue: () => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    d.setHours(9, 0, 0, 0)
    return d
  }},
]

export function ReminderModal({
  isOpen,
  onClose,
  onConfirm,
  initialDate,
}: ReminderModalProps) {
  const now = new Date()
  const defaultDate = initialDate || new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [dateValue, setDateValue] = useState(formatDateForInput(defaultDate))
  const [timeValue, setTimeValue] = useState(formatTimeForInput(defaultDate))
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const date = initialDate || new Date(Date.now() + 24 * 60 * 60 * 1000)
      setDateValue(formatDateForInput(date))
      setTimeValue(formatTimeForInput(date))
      setError('')
    }
  }, [isOpen, initialDate])

  // Handle escape key and focus trap
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
      // Focus first input
      setTimeout(() => {
        modalRef.current?.querySelector('input')?.focus()
      }, 100)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleQuickSelect = useCallback((getValue: () => Date) => {
    const date = getValue()
    setDateValue(formatDateForInput(date))
    setTimeValue(formatTimeForInput(date))
    setError('')
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')

      if (!dateValue || !timeValue) {
        setError('Please select both date and time')
        return
      }

      const selectedDate = new Date(`${dateValue}T${timeValue}`)

      if (selectedDate <= new Date()) {
        setError('Please select a future date and time')
        return
      }

      const maxDate = new Date()
      maxDate.setDate(maxDate.getDate() + 30)
      if (selectedDate > maxDate) {
        setError('Reminder cannot be more than 30 days in the future')
        return
      }

      setIsSubmitting(true)
      try {
        await onConfirm(selectedDate)
        onClose()
      } catch {
        setError('Failed to set reminder. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [dateValue, timeValue, onConfirm, onClose]
  )

  if (!isOpen) return null

  const minDate = formatDateForInput(new Date())
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 30)

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-title"
        className="fixed z-50 bg-white rounded-2xl shadow-2xl shadow-black/20
          inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto
          sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full
          animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header with gradient */}
        <div className="relative px-6 pt-6 pb-4">
          {/* Decorative gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 rounded-t-2xl" />

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 id="reminder-title" className="text-lg font-bold text-gray-900">
                  Set Reminder
                </h2>
                <p className="text-sm text-gray-500">Get notified when it's time to post</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 -mt-1 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 pb-6">
          {/* Quick select options */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Quick select
            </label>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleQuickSelect(option.getValue)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 hover:border-gray-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">or choose custom</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Custom date/time */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date input */}
            <div>
              <label htmlFor="reminder-date" className="block text-sm font-semibold text-gray-700 mb-2">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  id="reminder-date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  min={minDate}
                  max={formatDateForInput(maxDate)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Time input */}
            <div>
              <label htmlFor="reminder-time" className="block text-sm font-semibold text-gray-700 mb-2">
                Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="time"
                  id="reminder-time"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
            >
              Set Reminder
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
