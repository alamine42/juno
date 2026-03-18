import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '../login/page'

// Mock Supabase client
const mockSignInWithOtp = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
    },
  }),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the login form with email input and submit button', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows validation error for empty email', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/enter your email/i)).toBeInTheDocument()
    })
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('shows validation error for invalid email format', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'notanemail' } })
    // Use fireEvent.submit to bypass HTML5 validation in jsdom
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    })
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('calls signInWithOtp with valid email', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'coach@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'coach@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        },
      })
    })
  })

  it('shows success message after sending magic link', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'coach@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })

  it('shows error message when signInWithOtp fails', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: null, error: { message: 'Rate limit' } })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'coach@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/rate limit/i)).toBeInTheDocument()
    })
  })

  it('disables the button while submitting', async () => {
    mockSignInWithOtp.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'coach@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
    })
  })
})
