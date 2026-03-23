import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/admin/check
 *
 * Check if the current user has admin privileges.
 * Returns { isAdmin: boolean }
 */
export async function GET() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ isAdmin: false })
  }

  // Check admin flag using service client
  const serviceClient = createServiceClient()
  const { data: coach } = await serviceClient
    .from('coaches')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ isAdmin: coach?.is_admin ?? false })
}
