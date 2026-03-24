/**
 * Custom Clerk session claims type for admin checking.
 * These claims can be set via Clerk's public metadata.
 */
export interface ClerkSessionClaims {
  metadata?: {
    isAdmin?: boolean
  }
}

/**
 * Helper to check if session claims indicate admin access.
 */
export function hasAdminClaim(sessionClaims: unknown): boolean {
  const claims = sessionClaims as ClerkSessionClaims | undefined
  return claims?.metadata?.isAdmin === true
}
