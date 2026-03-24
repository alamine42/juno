import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock Clerk hooks for component tests
vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({
    signOut: vi.fn(),
    user: null,
  }),
  useUser: () => ({
    user: null,
    isLoaded: true,
    isSignedIn: false,
  }),
  useAuth: () => ({
    userId: null,
    isLoaded: true,
    isSignedIn: false,
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
  UserButton: () => null,
}))

// Mock Clerk server functions
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({
    userId: 'test-user-id',
    sessionClaims: {},
  })),
  currentUser: vi.fn(() => ({
    id: 'test-user-id',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    fullName: 'Test User',
  })),
  clerkMiddleware: vi.fn(),
  createRouteMatcher: vi.fn(() => () => false),
}))

// Mock database module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'test-id' }]),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => [{ id: 'test-id' }]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [{ id: 'test-id' }]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({})),
    })),
  },
}))

// Mock db helpers
vi.mock('@/lib/db/helpers', () => ({
  getCurrentCoach: vi.fn(() => ({ id: 'test-coach-id', clerkId: 'test-user-id' })),
  getOrCreateCoach: vi.fn(() => ({ id: 'test-coach-id', clerkId: 'test-user-id' })),
  getBrandProfile: vi.fn(() => null),
  getOrCreateBrandProfile: vi.fn(() => ({ id: 'test-profile-id', coachId: 'test-coach-id' })),
  isCurrentUserAdmin: vi.fn(() => false),
  requireAuth: vi.fn(() => 'test-user-id'),
  requireCoach: vi.fn(() => ({ id: 'test-coach-id', clerkId: 'test-user-id' })),
}))
