import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coaches } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { AppShell } from './AppShell'
import { hasAdminClaim } from '@/types/clerk'

interface AppShellWrapperProps {
  children: React.ReactNode
}

export async function AppShellWrapper({ children }: AppShellWrapperProps) {
  const { userId, sessionClaims } = await auth()

  let isAdmin = false

  if (userId) {
    // Check Clerk session claims first
    if (hasAdminClaim(sessionClaims)) {
      isAdmin = true
    } else {
      // Fall back to database check
      const [coach] = await db
        .select({ isAdmin: coaches.isAdmin })
        .from(coaches)
        .where(eq(coaches.clerkId, userId))

      isAdmin = coach?.isAdmin ?? false
    }
  }

  return (
    <AppShell isAdmin={isAdmin}>
      {children}
    </AppShell>
  )
}
