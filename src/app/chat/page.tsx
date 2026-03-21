'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { MessageBubble, type Message } from '@/components/chat/MessageBubble'
import { ChatInput } from '@/components/chat/ChatInput'
import { QuickActions } from '@/components/chat/QuickActions'
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
        <header className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">Chat with Juno</h1>
          <p className="text-sm text-gray-500">Your AI content assistant</p>
        </header>

        {/* Quick Actions */}
        <QuickActions onAction={sendMessage} disabled={isLoading} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-green-600">J</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Ready to create content
              </h2>
              <p className="text-gray-500 max-w-sm">
                Ask me anything about your Instagram content, or use the quick
                actions above to get started.
              </p>
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
                <div className="flex justify-center mb-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">
                    {error}
                  </div>
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
