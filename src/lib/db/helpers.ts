import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from './index'
import { coaches, brandProfiles, type Coach, type BrandProfile } from './schema'
import { eq } from 'drizzle-orm'
import { hasAdminClaim } from '@/types/clerk'

/**
 * Get the current coach record for the authenticated user.
 * Returns null if not authenticated or coach doesn't exist.
 */
export async function getCurrentCoach(): Promise<Coach | null> {
  const { userId } = await auth()
  if (!userId) return null

  const [coach] = await db
    .select()
    .from(coaches)
    .where(eq(coaches.clerkId, userId))

  return coach ?? null
}

/**
 * Get or create a coach record for the authenticated user.
 * Throws if not authenticated.
 */
export async function getOrCreateCoach(): Promise<Coach> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // Try to find existing coach
  let [coach] = await db
    .select()
    .from(coaches)
    .where(eq(coaches.clerkId, userId))

  if (!coach) {
    // Create new coach from Clerk user info
    const user = await currentUser()
    const [newCoach] = await db
      .insert(coaches)
      .values({
        clerkId: userId,
        email: user?.emailAddresses[0]?.emailAddress ?? '',
        name: user?.fullName ?? user?.firstName ?? null,
      })
      .returning()

    coach = newCoach
  }

  return coach
}

/**
 * Get the brand profile for a coach.
 * Returns null if no profile exists.
 */
export async function getBrandProfile(
  coachId: string
): Promise<BrandProfile | null> {
  const [profile] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.coachId, coachId))

  return profile ?? null
}

/**
 * Get or create a brand profile for a coach.
 */
export async function getOrCreateBrandProfile(
  coachId: string
): Promise<BrandProfile> {
  let [profile] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.coachId, coachId))

  if (!profile) {
    const [newProfile] = await db
      .insert(brandProfiles)
      .values({ coachId })
      .returning()

    profile = newProfile
  }

  return profile
}

/**
 * Check if the current user is an admin.
 * First checks Clerk session claims, then falls back to database.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { sessionClaims, userId } = await auth()

  // Check Clerk session claims first (faster)
  if (hasAdminClaim(sessionClaims)) {
    return true
  }

  // Fall back to database check
  if (!userId) return false

  const [coach] = await db
    .select({ isAdmin: coaches.isAdmin })
    .from(coaches)
    .where(eq(coaches.clerkId, userId))

  return coach?.isAdmin ?? false
}

/**
 * Get the authenticated user's Clerk ID.
 * Throws if not authenticated.
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  return userId
}

/**
 * Get the current coach, throwing if not authenticated or coach doesn't exist.
 */
export async function requireCoach(): Promise<Coach> {
  const coach = await getCurrentCoach()
  if (!coach) throw new Error('Unauthorized')
  return coach
}
