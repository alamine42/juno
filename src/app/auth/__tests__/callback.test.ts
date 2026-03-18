import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted to create mocks that can be referenced in vi.mock factory
const { mockExchangeCodeForSession, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockExchangeCodeForSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}))

import { GET } from '../callback/route'

describe('Auth Callback Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login with error when no code is provided', async () => {
    const request = new NextRequest('http://localhost:3000/auth/callback')
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/auth/login')
    expect(response.headers.get('location')).toContain('error=missing_code')
  })

  it('exchanges code for session and redirects to chat', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { completed_at: '2024-01-01' },
            error: null,
          }),
        }),
      }),
    })

    const request = new NextRequest('http://localhost:3000/auth/callback?code=valid-code')
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-code')
    expect(response.headers.get('location')).toContain('/chat')
  })

  it('redirects to onboarding when brand profile is not completed', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { completed_at: null },
            error: null,
          }),
        }),
      }),
    })

    const request = new NextRequest('http://localhost:3000/auth/callback?code=valid-code')
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/onboarding')
  })

  it('redirects to login with error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: null, error: { message: 'Invalid code' } })

    const request = new NextRequest('http://localhost:3000/auth/callback?code=bad-code')
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/auth/login')
    expect(response.headers.get('location')).toContain('error=auth_failed')
  })
})
