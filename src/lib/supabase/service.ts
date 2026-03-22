/**
 * Supabase service role client for admin operations.
 * Use sparingly - bypasses RLS.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let serviceClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

/**
 * Get the Supabase service role client.
 * This client bypasses Row Level Security - use with caution.
 *
 * Use cases:
 * - Reading content_frameworks (public data, no coach_id)
 * - Admin operations that need to cross user boundaries
 * - Background jobs without user context
 */
export function getServiceClient() {
  if (serviceClient) {
    return serviceClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase service role configuration. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    )
  }

  serviceClient = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return serviceClient
}

/**
 * Check if service role client is available.
 * Useful for graceful degradation in environments without service key.
 */
export function isServiceClientAvailable(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
