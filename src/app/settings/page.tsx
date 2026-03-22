'use client'

import { useState, useEffect, useMemo } from 'react'
import { User, Palette, Bell, LogOut } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { BrandProfileForm } from '@/components/settings/BrandProfileForm'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { type BrandProfile, type Coach } from '@/types/database'
import { useRouter } from 'next/navigation'

type SettingsTab = 'brand' | 'account' | 'notifications'

const TABS: { value: SettingsTab; label: string; icon: typeof Palette }[] = [
  { value: 'brand', label: 'Brand Voice', icon: Palette },
  { value: 'account', label: 'Account', icon: User },
  // { value: 'notifications', label: 'Notifications', icon: Bell },  // Future
]

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SettingsTab>('brand')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<BrandProfile | null>(null)
  const [coach, setCoach] = useState<Coach | null>(null)
  // Memoize client to prevent infinite useEffect loop
  const supabase = useMemo(() => createClient(), [])

  // Fetch profile data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/auth/login')
          return
        }

        // Fetch coach data
        const { data: coachData } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', user.id)
          .single()

        if (coachData) {
          setCoach(coachData as Coach)
        }

        // Fetch brand profile
        const { data: profileData } = await supabase
          .from('brand_profiles')
          .select('*')
          .eq('coach_id', user.id)
          .single()

        if (profileData) {
          setProfile(profileData as BrandProfile)
        }
      } catch (err) {
        console.error('Failed to fetch settings data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <AppShell>
      <div className="flex flex-col h-screen lg:h-screen">
        {/* Header */}
        <header className="flex-shrink-0 px-4 sm:px-5 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Customize your Juno experience</p>
        </header>

        {/* Tabs */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-2 bg-white border-b border-gray-100">
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                    activeTab === tab.value
                      ? 'bg-green-100 text-green-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-500">Loading settings...</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {/* Brand Voice Tab */}
              {activeTab === 'brand' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Brand Voice</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Help Juno understand your unique style and tone so every piece of content sounds like you.
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                    <BrandProfileForm initialProfile={profile} />
                  </div>
                </div>
              )}

              {/* Account Tab */}
              {activeTab === 'account' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Account</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage your account settings and preferences.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* User info card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Email
                          </label>
                          <p className="text-sm text-gray-900">{coach?.email || 'Not set'}</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Name
                          </label>
                          <p className="text-sm text-gray-900">{coach?.name || 'Not set'}</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Timezone
                          </label>
                          <p className="text-sm text-gray-900">{coach?.timezone || 'UTC'}</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Member since
                          </label>
                          <p className="text-sm text-gray-900">
                            {coach?.created_at
                              ? new Date(coach.created_at).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Sign out */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Sign Out</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Sign out of your Juno account on this device.
                      </p>
                      <Button variant="secondary" onClick={handleSignOut}>
                        <LogOut className="w-4 h-4 mr-1.5" />
                        Sign Out
                      </Button>
                    </div>

                    {/* Danger zone */}
                    <div className="bg-white rounded-xl border border-red-200 p-5 sm:p-6">
                      <h3 className="text-sm font-semibold text-red-900 mb-2">Danger Zone</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Once you delete your account, there is no going back. All your content and data will be permanently removed.
                      </p>
                      <Button
                        variant="secondary"
                        className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                        onClick={() => alert('Please contact support to delete your account.')}
                      >
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab (Future) */}
              {activeTab === 'notifications' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Choose how and when you want to be notified.
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                    <p className="text-sm text-gray-500 text-center py-8">
                      Notification settings coming soon...
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
