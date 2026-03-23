import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

/**
 * Skeleton loading placeholder with shimmer animation.
 * Use for loading states to indicate content shape while loading.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-gray-200',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer',
        'before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  )
}

/**
 * ContentCard skeleton for loading state in drafts list.
 */
export function ContentCardSkeleton() {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-5"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>

      {/* Content preview */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

/**
 * Message skeleton for chat loading state.
 */
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`} aria-hidden="true">
      {!isUser && (
        <div className="flex-shrink-0 mr-3 mt-0.5">
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? 'bg-gray-200' : 'bg-white border border-gray-200'} rounded-2xl px-4 py-3`}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    </div>
  )
}

/**
 * Settings form skeleton for loading state.
 */
export function SettingsFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div>
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-4 w-28 mb-2" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
  )
}
