import { createClient } from '@/lib/supabase/server'
import { AppShell } from './AppShell'

interface AppShellWrapperProps {
  children: React.ReactNode
}

export async function AppShellWrapper({ children }: AppShellWrapperProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = process.env.ADMIN_EMAIL
  const isAdmin = Boolean(adminEmail && user?.email === adminEmail)

  return (
    <AppShell isAdmin={isAdmin}>
      {children}
    </AppShell>
  )
}
