import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OnboardingPage from '../page'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}))

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  it('renders the first step (style words)', () => {
    render(<OnboardingPage />)
    expect(screen.getByText(/coaching style/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows step indicator', () => {
    render(<OnboardingPage />)
    expect(screen.getByText(/step 1/i)).toBeInTheDocument()
  })

  it('prevents advancing with empty required field', async () => {
    render(<OnboardingPage />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument()
    })
    // Should still be on step 1
    expect(screen.getByText(/step 1/i)).toBeInTheDocument()
  })

  it('advances to step 2 when step 1 is filled', async () => {
    render(<OnboardingPage />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'energetic, raw, supportive' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText(/step 2/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/tone/i)).toBeInTheDocument()
  })

  it('allows going back to previous step', async () => {
    render(<OnboardingPage />)
    // Fill step 1 and advance
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'energetic' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText(/step 2/i)).toBeInTheDocument()
    })
    // Go back
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    await waitFor(() => {
      expect(screen.getByText(/step 1/i)).toBeInTheDocument()
    })
  })

  it('shows skip button', () => {
    render(<OnboardingPage />)
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('skipping calls API and redirects to chat', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    render(<OnboardingPage />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('skip'),
      }))
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/chat')
    })
  })

  it('completing all steps shows wow moment with sample post', async () => {
    // Mock profile save success and chat generation success
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // /api/profile
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Sample post content!' }) }) // /api/chat

    render(<OnboardingPage />)

    // Step 1: Style words
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'energetic, raw' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 2: Tone (select)
    await waitFor(() => expect(screen.getByText(/step 2/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/motivational/i))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 3: Emoji usage (select)
    await waitFor(() => expect(screen.getByText(/step 3/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/sparingly/i))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 4: Sign-off
    await waitFor(() => expect(screen.getByText(/step 4/i)).toBeInTheDocument())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: "Let's go!" } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 5: Avoided topics
    await waitFor(() => expect(screen.getByText(/step 5/i)).toBeInTheDocument())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'politics' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 6: Optional questions — finish
    await waitFor(() => expect(screen.getByText(/step 6/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /finish/i }))

    // Should show loading state first
    await waitFor(() => {
      expect(screen.getByText(/let me show you something/i)).toBeInTheDocument()
    })

    // Then show the preview with "Sound like you?"
    await waitFor(() => {
      expect(screen.getByText(/sound like you/i)).toBeInTheDocument()
    })

    // Verify profile was saved
    expect(mockFetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
      method: 'PATCH',
      body: expect.stringContaining('energetic'),
    }))

    // Verify sample was generated
    expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('clicking "Yes, let\'s go!" redirects to chat', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Sample post!' }) })

    render(<OnboardingPage />)

    // Complete all steps quickly
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 2/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/motivational/i))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 3/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/sparingly/i))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 4/i)).toBeInTheDocument())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 5/i)).toBeInTheDocument())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 6/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /finish/i }))

    // Wait for preview
    await waitFor(() => {
      expect(screen.getByText(/sound like you/i)).toBeInTheDocument()
    })

    // Click "Yes, let's go!"
    fireEvent.click(screen.getByRole('button', { name: /yes.*let.*go/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/chat')
    })
  })

  it('clicking "Not quite" goes back to form', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Sample!' }) })

    render(<OnboardingPage />)

    // Complete all steps quickly
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 2/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/motivational/i))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 3/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/sparingly/i))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 4/i)).toBeInTheDocument())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 5/i)).toBeInTheDocument())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/step 6/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /finish/i }))

    // Wait for preview
    await waitFor(() => {
      expect(screen.getByText(/sound like you/i)).toBeInTheDocument()
    })

    // Click "Not quite"
    fireEvent.click(screen.getByRole('button', { name: /not quite/i }))

    // Should go back to step 1
    await waitFor(() => {
      expect(screen.getByText(/step 1/i)).toBeInTheDocument()
    })
  })
})
