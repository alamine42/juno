'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MessageBubble, type Message } from '@/components/chat/MessageBubble'
import { ChatInput } from '@/components/chat/ChatInput'
import { QuickActions } from '@/components/chat/QuickActions'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load chat history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const { data: history, error: historyError } = await supabase
          .from('chat_messages')
          .select('id, role, content, content_id')
          .order('created_at', { ascending: true })
          .limit(50)

        if (historyError) throw historyError

        setMessages(
          history?.map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            contentId: msg.content_id ?? undefined,
          })) ?? []
        )
      } catch (err) {
        console.error('Failed to load chat history:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    // Check if user is admin (for AppShell)
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      // We can't access ADMIN_EMAIL on client, so we'll just show without admin
      // The server-side AppShellWrapper handles this properly
      setIsAdmin(false)
    }

    loadHistory()
    checkAdmin()
  }, [supabase])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if (isLoading) return

    // Clear any previous error
    setError(null)

    // Optimistic UI: add user message immediately
    const tempUserId = `temp-${Date.now()}`
    const userMessage: Message = {
      id: tempUserId,
      role: 'user',
      content,
    }

    // Add loading message for assistant
    const loadingId = `loading-${Date.now()}`
    const loadingMessage: Message = {
      id: loadingId,
      role: 'assistant',
      content: '',
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send message')
      }

      // Replace loading message with actual response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingId
            ? {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.message,
                contentId: data.contentId,
                isLoading: false,
              }
            : msg
        )
      )
    } catch (err) {
      // Remove loading message and show error
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingId))
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  const handleSaveDraft = useCallback(async (content: string) => {
    try {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: content,
          type: 'instagram_post',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save draft')
      }

      const data = await response.json()

      // Update the message to show it's been saved
      setMessages((prev) =>
        prev.map((msg) =>
          msg.content === content && msg.role === 'assistant'
            ? { ...msg, contentId: data.id }
            : msg
        )
      )
    } catch (err) {
      console.error('Failed to save draft:', err)
    }
  }, [])

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col h-screen lg:h-screen">
        {/* Header */}
        <header className="flex-shrink-0 px-4 sm:px-5 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Chat with Juno</h1>
              <p className="text-sm text-gray-500 mt-0.5">Your AI content assistant</p>
            </div>
            {/* Status indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-700">Ready</span>
            </div>
          </div>
        </header>

        {/* Quick Actions */}
        <QuickActions onAction={sendMessage} disabled={isLoading} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center h-full">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-500">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              {/* Enhanced empty state */}
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
                <span className="text-3xl font-bold text-white">J</span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Ready to create?
              </h2>
              <p className="text-gray-600 max-w-sm mb-8">
                I'm Juno, your AI content assistant. Ask me anything about your Instagram strategy, or try one of the quick actions above.
              </p>

              {/* Visual hint cards */}
              <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-sm font-medium text-green-900">💡 Try asking me to plan your week</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">✨ Or get fresh content ideas</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onSaveDraft={handleSaveDraft}
                />
              ))}
              {error && (
                <div className="flex items-start gap-3 mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">{error}</p>
                    <p className="text-sm text-red-700 mt-1">Try your message again or refresh the page</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-600 hover:text-red-800 transition p-1"
                    aria-label="Dismiss error"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder="Ask Juno anything..."
        />
      </div>
    </AppShell>
  )
}
