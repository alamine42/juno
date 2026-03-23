import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to create mock that can be referenced in vi.mock
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

// Mock Resend before importing
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend }
  },
}))

// Mock environment variables
vi.mock('@/lib/env', () => ({
  RESEND_API_KEY: 'test-resend-key',
  NEXT_PUBLIC_APP_URL: 'https://test.app',
}))

import { sendMagicLink, sendPostingReminder } from '../resend'

describe('sendMagicLink', () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  it('sends email with correct from/to/subject', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    await sendMagicLink('user@example.com', 'https://app.com/auth?token=abc')

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('user@example.com')
    expect(call.subject).toBe('Sign in to Juno')
    expect(call.from).toContain('Juno')
    expect(call.html).toContain('Sign In')
  })

  it('throws on Resend error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key' },
    })

    await expect(
      sendMagicLink('user@example.com', 'https://app.com/auth?token=abc')
    ).rejects.toBeDefined()
  })

  it('encodes magic link URL for safety', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    await sendMagicLink('user@example.com', 'https://app.com/auth?token=abc&foo=bar')

    const call = mockSend.mock.calls[0][0]
    // Should be safe URL (encodeURI handles spaces and special chars)
    expect(call.html).toContain('href="https://app.com/auth?token=abc&foo=bar"')
  })
})

describe('sendPostingReminder', () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  it('sends email with correct subject preview', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    await sendPostingReminder(
      'coach@example.com',
      'Coach Jane',
      'This is a great caption for your next Instagram post about fitness',
      'content-123'
    )

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('coach@example.com')
    expect(call.subject).toContain('Time to post')
    expect(call.subject).toContain('This is a great caption')
    expect(call.html).toContain('Hey Coach Jane')
  })

  it('escapes HTML in coach name (XSS prevention)', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    await sendPostingReminder(
      'coach@example.com',
      '<script>alert("xss")</script>',
      'Test content',
      'content-123'
    )

    const call = mockSend.mock.calls[0][0]
    // Should be HTML-escaped
    expect(call.html).not.toContain('<script>')
    expect(call.html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in content preview (XSS prevention)', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    await sendPostingReminder(
      'coach@example.com',
      'Coach',
      '<img src=x onerror="alert(1)">',
      'content-123'
    )

    const call = mockSend.mock.calls[0][0]
    // Should be HTML-escaped
    expect(call.html).not.toContain('<img')
    expect(call.html).toContain('&lt;img')
  })

  it('builds correct content URL', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    await sendPostingReminder(
      'coach@example.com',
      'Coach',
      'Test content',
      'abc-123-def'
    )

    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('https://test.app/content/abc-123-def')
  })

  it('throws on Resend error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Rate limited' },
    })

    await expect(
      sendPostingReminder('coach@example.com', 'Coach', 'Content', 'id-123')
    ).rejects.toBeDefined()
  })

  it('handles null coach name gracefully', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    // @ts-expect-error - testing runtime null handling
    await sendPostingReminder('coach@example.com', null, 'Content', 'id-123')

    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('Hey there')
  })

  it('sends warning email for yellow-flagged content', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    await sendPostingReminder(
      'coach@example.com',
      'Coach',
      'Content with issues',
      'id-123',
      { hasWarning: true, warningReasons: ['Contains hedging phrases: maybe'] }
    )

    const call = mockSend.mock.calls[0][0]
    expect(call.subject).toContain('Review needed')
    expect(call.html).toContain('Review Recommended')
    expect(call.html).toContain('hedging phrases')
    // Should NOT have copy button for yellow content
    expect(call.html).not.toContain('Copy to Clipboard')
  })

  it('sends normal email for green content', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })

    await sendPostingReminder(
      'coach@example.com',
      'Coach',
      'Clean content',
      'id-123',
      { hasWarning: false }
    )

    const call = mockSend.mock.calls[0][0]
    expect(call.subject).toContain('Time to post')
    expect(call.html).not.toContain('Review Recommended')
    expect(call.html).toContain('Copy to Clipboard')
  })
})
