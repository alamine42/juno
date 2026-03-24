'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { MessageCircle, FileText, Settings, LogOut, Shield } from 'lucide-react'

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
  const { signOut } = useClerk()

  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  async function handleSignOut() {
    await signOut({ redirectUrl: '/sign-in' })
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Skip to main content link - visible on focus for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
              J
            </div>
            <span className="text-lg font-bold text-gray-900">Juno</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-green-50 text-green-700 border-l-4 border-green-600 -ml-px'
                    : 'text-gray-700 hover:bg-gray-100 border-l-4 border-transparent -ml-px'
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-colors ${
                  isActive ? 'text-green-600' : 'text-gray-400'
                }`} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sign Out */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            aria-label="Sign out of your account"
            className="flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="w-5 h-5 mr-3" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main id="main-content" className="flex-1 lg:pl-64 pb-20 lg:pb-0" tabIndex={-1}>
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50 pb-safe"
        aria-label="Mobile navigation"
        role="navigation"
      >
        <div className="flex justify-around">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`flex flex-col items-center justify-center py-3 px-3 min-w-[60px] min-h-[64px] relative transition-colors duration-200 ${
                  isActive ? 'text-green-600' : 'text-gray-500 active:text-gray-700'
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500`}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-600 rounded-full" aria-hidden="true" />
                )}
                <Icon className="w-6 h-6" aria-hidden="true" />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="flex flex-col items-center justify-center py-3 px-3 min-w-[60px] min-h-[64px] text-gray-500 active:text-gray-700 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
          >
            <LogOut className="w-6 h-6" aria-hidden="true" />
            <span className="text-xs mt-1 font-medium">Sign Out</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
