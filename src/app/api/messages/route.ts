import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatMessages } from '@/lib/db/schema'
import { getOrCreateCoach } from '@/lib/db/helpers'
import { eq, asc } from 'drizzle-orm'

/**
 * GET /api/messages
 * Get chat history for the current user
 */
export async function GET() {
  try {
    const coach = await getOrCreateCoach()

    const messages = await db
      .select({
        id: chatMessages.id,
        role: chatMessages.role,
        content: chatMessages.content,
        content_id: chatMessages.contentId,
      })
      .from(chatMessages)
      .where(eq(chatMessages.coachId, coach.id))
      .orderBy(asc(chatMessages.createdAt))
      .limit(50)

    return NextResponse.json(messages)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
    console.error('Messages fetch error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
