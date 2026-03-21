'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MessageCircle, FileText, Settings, LogOut, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: typeof MessageCircle
}

const NAV_ITEMS: NavItem[] = [
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/drafts', label: 'Drafts', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const ADMIN_ITEM: NavItem = {
  href: '/admin',
  label: 'Admin',
  icon: Shield,
}

interface AppShellProps {
  children: React.ReactNode
  isAdmin?: boolean
}

export function AppShell({ children, isAdmin = false }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-600 text-sm font-bold mr-3">
            J
          </span>
          <span className="text-lg font-semibold">Juno</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign Out */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 pb-16 lg:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 safe-area-inset-bottom">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-2 px-3 min-w-[64px] min-h-[56px] ${
                  isActive ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={handleSignOut}
            className="flex flex-col items-center py-2 px-3 min-w-[64px] min-h-[56px] text-gray-500"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-xs mt-1">Sign Out</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
