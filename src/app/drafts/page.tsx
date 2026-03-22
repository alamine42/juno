'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Calendar, FileText, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { ContentCard } from '@/components/content/ContentCard'
import { ReminderModal } from '@/components/content/ReminderModal'
import { BatchModal } from '@/components/content/BatchModal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { type Content } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type TabFilter = 'all' | 'draft' | 'reminder_set' | 'posted'

const TABS: { value: TabFilter; label: string; count?: number }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'reminder_set', label: 'Scheduled' },
  { value: 'posted', label: 'Posted' },
]

export default function DraftsPage() {
  const router = useRouter()
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [reminderModalOpen, setReminderModalOpen] = useState(false)
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const supabase = createClient()

  // Fetch content
  const fetchContent = useCallback(async () => {
    setLoading(true)
    try {
      const url = activeTab === 'all' ? '/api/content' : `/api/content?status=${activeTab}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch content')
      }

      const data = await response.json()
      setContents(data)
    } catch (err) {
      console.error('Failed to fetch content:', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchContent()
  }, [fetchContent])

  // Handle edit
  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/chat?edit=${id}`)
    },
    [router]
  )

  // Handle delete
  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this content?')) return

      try {
        const response = await fetch(`/api/content/${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error('Failed to delete')
        }

        setContents((prev) => prev.filter((c) => c.id !== id))
      } catch (err) {
        console.error('Failed to delete:', err)
      }
    },
    []
  )

  // Handle copy tracking
  const handleCopy = useCallback((id: string) => {
    fetch('/api/content/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId: id, event: 'copied' }),
    }).catch(() => {})
  }, [])

  // Handle set reminder
  const handleSetReminder = useCallback((id: string) => {
    setSelectedContentId(id)
    setReminderModalOpen(true)
  }, [])

  // Handle reminder confirm
  const handleReminderConfirm = useCallback(
    async (datetime: Date) => {
      if (!selectedContentId) return

      try {
        const response = await fetch(`/api/content/${selectedContentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reminder_at: datetime.toISOString(),
            status: 'reminder_set',
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to set reminder')
        }

        await fetchContent()
      } catch (err) {
        console.error('Failed to set reminder:', err)
        throw err
      }
    },
    [selectedContentId, fetchContent]
  )

  // Handle batch complete
  const handleBatchComplete = useCallback(
    (batchId: string, count: number) => {
      fetchContent()
    },
    [fetchContent]
  )

  // Filter content by tab and search
  const filteredContents = contents.filter((c) => {
    const matchesTab = activeTab === 'all' || c.status === activeTab
    const matchesSearch = !searchQuery || c.body.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  // Count by status
  const counts = {
    all: contents.length,
    draft: contents.filter(c => c.status === 'draft').length,
    reminder_set: contents.filter(c => c.status === 'reminder_set').length,
    posted: contents.filter(c => c.status === 'posted').length,
  }

  return (
    <AppShell>
      <div className="flex flex-col min-h-screen bg-gray-50/50">
        {/* Header - Enhanced with gradient */}
        <header className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-5 bg-white border-b border-gray-200/80 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Content Library</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {contents.length} {contents.length === 1 ? 'piece' : 'pieces'} of content
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setBatchModalOpen(true)}
                  className="hidden sm:flex shadow-sm"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Plan Week
                </Button>
                <Button onClick={() => router.push('/chat')} className="shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  <span>Create</span>
                </Button>
              </div>
            </div>

            {/* Tabs & Search row */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Tabs - Pill style */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`relative px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                      activeTab === tab.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                    {counts[tab.value] > 0 && (
                      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                        activeTab === tab.value
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-200/60 text-gray-500'
                      }`}>
                        {counts[tab.value]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Search - Desktop only */}
              <div className="hidden sm:block flex-1 max-w-xs ml-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-gray-500 font-medium">Loading content...</p>
              </div>
            ) : filteredContents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                {/* Empty state illustration */}
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <FileText className="w-12 h-12 text-gray-300" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {searchQuery
                    ? 'No matches found'
                    : activeTab === 'all'
                      ? 'Start creating content'
                      : `No ${activeTab === 'draft' ? 'drafts' : activeTab === 'reminder_set' ? 'scheduled posts' : 'posted content'} yet`}
                </h3>
                <p className="text-sm text-gray-500 mb-6 max-w-sm">
                  {searchQuery
                    ? 'Try a different search term or clear your search'
                    : 'Let Juno help you create engaging content for your audience'}
                </p>

                {!searchQuery && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="secondary" onClick={() => setBatchModalOpen(true)} className="shadow-sm">
                      <Calendar className="w-4 h-4 mr-2" />
                      Plan Your Week
                    </Button>
                    <Button onClick={() => router.push('/chat')} className="shadow-sm">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create with AI
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredContents.map((content) => (
                  <ContentCard
                    key={content.id}
                    content={content}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onCopy={handleCopy}
                    onSetReminder={handleSetReminder}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile FAB for batch - Enhanced */}
        <button
          onClick={() => setBatchModalOpen(true)}
          className="sm:hidden fixed right-5 bottom-24 w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl shadow-xl shadow-green-500/30 flex items-center justify-center hover:from-green-600 hover:to-emerald-700 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          aria-label="Plan week"
        >
          <Calendar className="w-6 h-6" />
        </button>

        {/* Secondary FAB for create - Mobile */}
        <button
          onClick={() => router.push('/chat')}
          className="sm:hidden fixed right-5 bottom-[120px] w-11 h-11 bg-white border border-gray-200 text-gray-700 rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
          aria-label="Create content"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Modals */}
      <ReminderModal
        isOpen={reminderModalOpen}
        onClose={() => {
          setReminderModalOpen(false)
          setSelectedContentId(null)
        }}
        onConfirm={handleReminderConfirm}
      />

      <BatchModal
        isOpen={batchModalOpen}
        onClose={() => {
          setBatchModalOpen(false)
          fetchContent()
        }}
        onComplete={handleBatchComplete}
      />
    </AppShell>
  )
}
