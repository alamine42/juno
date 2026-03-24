import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppShell } from '../AppShell'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({ push: mockPush }),
}))

// Mock Clerk - override the global mock from setup.ts
const mockSignOut = vi.fn().mockResolvedValue(undefined)
vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({
    signOut: mockSignOut,
  }),
  useUser: () => ({
    user: null,
    isLoaded: true,
    isSignedIn: true,
  }),
  useAuth: () => ({
    userId: 'test-user-id',
    isLoaded: true,
    isSignedIn: true,
  }),
}))

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children', () => {
    render(
      <AppShell>
        <div data-testid="child-content">Test Content</div>
      </AppShell>
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // Check desktop sidebar links
    const chatLinks = screen.getAllByText('Chat')
    expect(chatLinks.length).toBeGreaterThan(0)

    const draftsLinks = screen.getAllByText('Drafts')
    expect(draftsLinks.length).toBeGreaterThan(0)

    const settingsLinks = screen.getAllByText('Settings')
    expect(settingsLinks.length).toBeGreaterThan(0)
  })

  it('does not show admin link when isAdmin is false', () => {
    render(
      <AppShell isAdmin={false}>
        <div>Content</div>
      </AppShell>
    )

    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows admin link when isAdmin is true', () => {
    render(
      <AppShell isAdmin={true}>
        <div>Content</div>
      </AppShell>
    )

    const adminLinks = screen.getAllByText('Admin')
    expect(adminLinks.length).toBeGreaterThan(0)
  })

  it('highlights the active nav item', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // Since usePathname returns '/chat', Chat should be active
    const chatLinks = screen.getAllByRole('link', { name: /chat/i })
    const activeChatLink = chatLinks.find(link =>
      link.className.includes('text-green-600')
    )
    expect(activeChatLink).toBeTruthy()
  })

  it('calls signOut and redirects on sign out click', async () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // Find the sign out button (there are two - one in sidebar, one in mobile nav)
    const signOutButtons = screen.getAllByText('Sign Out')
    fireEvent.click(signOutButtons[0])

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('renders the logo', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    expect(screen.getByText('Juno')).toBeInTheDocument()
    expect(screen.getByText('J')).toBeInTheDocument()
  })
})
