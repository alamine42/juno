'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Activity, Database, Clock, Users, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

interface AdminHealthData {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version: string
  services: {
    database: 'ok' | 'error'
    cron: {
      lastRun: string | null
      status: 'ok' | 'stale' | 'never'
      processed?: number
      skipped?: number
      errors?: number
    }
  }
}

interface AdminStats {
  totalCoaches: number
  totalContent: number
  contentByStatus: {
    draft: number
    reminder_set: number
    posted: number
  }
}

function StatusBadge({ status }: { status: 'ok' | 'degraded' | 'down' | 'error' | 'stale' | 'never' }) {
  const styles = {
    ok: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    degraded: 'bg-amber-100 text-amber-800 border-amber-200',
    down: 'bg-red-100 text-red-800 border-red-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    stale: 'bg-amber-100 text-amber-800 border-amber-200',
    never: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const icons = {
    ok: CheckCircle,
    degraded: AlertTriangle,
    down: XCircle,
    error: XCircle,
    stale: AlertTriangle,
    never: Clock,
  }

  const Icon = icons[status]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status]}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string
  value: string | number
  icon: typeof Users
  subtitle?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gray-100 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [health, setHealth] = useState<AdminHealthData | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const supabase = createClient()

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      // Fetch admin health endpoint
      const healthResponse = await fetch('/api/admin/health')

      if (healthResponse.status === 401) {
        router.push('/auth/login')
        return
      }

      if (healthResponse.status === 403) {
        setIsAdmin(false)
        return
      }

      if (!healthResponse.ok) {
        throw new Error('Failed to fetch health data')
      }

      setIsAdmin(true)
      const healthData = await healthResponse.json()
      setHealth(healthData)

      // Fetch stats (we can do this since we're admin)
      const { data: coaches } = await supabase
        .from('coaches')
        .select('id', { count: 'exact', head: true })

      const { data: content, count: totalContent } = await supabase
        .from('content')
        .select('status', { count: 'exact' })

      // Group by status
      const statusCounts = { draft: 0, reminder_set: 0, posted: 0 }
      if (content) {
        content.forEach((c: { status: string }) => {
          if (c.status in statusCounts) {
            statusCounts[c.status as keyof typeof statusCounts]++
          }
        })
      }

      setStats({
        totalCoaches: coaches?.length ?? 0,
        totalContent: totalContent ?? 0,
        contentByStatus: statusCounts,
      })
    } catch (err) {
      console.error('Admin fetch error:', err)
      setError('Failed to load admin data. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Not admin - show forbidden message
  if (isAdmin === false) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 text-center max-w-md mb-6">
            You don't have admin privileges. If you believe this is an error, please contact support.
          </p>
          <Button onClick={() => router.push('/chat')}>Return to Chat</Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell isAdmin={true}>
      <div className="flex flex-col min-h-screen bg-gray-50/50">
        {/* Header */}
        <header className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-5 bg-white border-b border-gray-200/80 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">System health and statistics</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {/* Error */}
            {error && (
              <ErrorMessage
                message={error}
                onRetry={() => fetchData()}
                onDismiss={() => setError(null)}
                className="mb-6"
              />
            )}

            {loading ? (
              <div className="space-y-6" role="status" aria-label="Loading admin data">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-6 w-12" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <Skeleton className="h-5 w-32 mb-4" />
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                  </div>
                </div>
                <span className="sr-only">Loading admin data...</span>
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatCard
                    title="Total Coaches"
                    value={stats?.totalCoaches ?? 0}
                    icon={Users}
                  />
                  <StatCard
                    title="Total Content"
                    value={stats?.totalContent ?? 0}
                    icon={FileText}
                  />
                  <StatCard
                    title="Drafts"
                    value={stats?.contentByStatus.draft ?? 0}
                    icon={FileText}
                    subtitle="Awaiting scheduling"
                  />
                  <StatCard
                    title="Scheduled"
                    value={stats?.contentByStatus.reminder_set ?? 0}
                    icon={Clock}
                    subtitle="Reminders active"
                  />
                </div>

                {/* Health Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* System Health */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-gray-400" aria-hidden="true" />
                        System Health
                      </h2>
                      {health && <StatusBadge status={health.status} />}
                    </div>

                    <div className="space-y-4">
                      {/* Database */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Database className="w-5 h-5 text-gray-400" aria-hidden="true" />
                          <div>
                            <p className="font-medium text-gray-900">Database</p>
                            <p className="text-sm text-gray-500">Supabase connection</p>
                          </div>
                        </div>
                        <StatusBadge status={health?.services.database ?? 'error'} />
                      </div>

                      {/* Cron */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-gray-400" aria-hidden="true" />
                          <div>
                            <p className="font-medium text-gray-900">Cron Jobs</p>
                            <p className="text-sm text-gray-500">
                              {health?.services.cron.lastRun
                                ? `Last run: ${new Date(health.services.cron.lastRun).toLocaleString()}`
                                : 'Never run'}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={health?.services.cron.status ?? 'never'} />
                      </div>
                    </div>
                  </div>

                  {/* Cron Statistics */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-gray-400" aria-hidden="true" />
                      Last Cron Run
                    </h2>

                    {health?.services.cron.lastRun ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-emerald-50 rounded-lg">
                          <p className="text-2xl font-bold text-emerald-700">
                            {health.services.cron.processed ?? 0}
                          </p>
                          <p className="text-sm text-emerald-600 mt-1">Processed</p>
                        </div>
                        <div className="text-center p-4 bg-amber-50 rounded-lg">
                          <p className="text-2xl font-bold text-amber-700">
                            {health.services.cron.skipped ?? 0}
                          </p>
                          <p className="text-sm text-amber-600 mt-1">Skipped</p>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-700">
                            {health.services.cron.errors ?? 0}
                          </p>
                          <p className="text-sm text-red-600 mt-1">Errors</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                        <p>No cron runs recorded yet</p>
                        <p className="text-sm mt-1">The cron job runs every 30 minutes</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer info */}
                <div className="mt-6 text-center text-sm text-gray-400">
                  Version {health?.version ?? '1.0.0'} • Last updated:{' '}
                  {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A'}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
