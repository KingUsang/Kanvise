import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

/**
 * Streamed straight away on a full page load of any /dashboard page, while
 * the server checks the sign-in (16 R-08: skeletons within 100ms). Shaped
 * like the shell: sidebar or rail from 768px, top and bottom bars on phones,
 * and a page title with two panels. The shell replaces it with its own
 * skeletons and then the real content.
 */
export function ShellFirstPaintSkeleton() {
  return (
    <SkeletonGroup label="Loading Kanvise" className="min-h-dvh bg-dashboard-page font-sans">
      <div className="fixed inset-y-0 left-0 hidden w-dashboard-rail flex-col gap-3 border-r border-dashboard-outline p-3 md:flex lg:w-dashboard-sidebar">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-14 w-full rounded-dashboard-panel" />
        {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}
      </div>
      <div className="flex h-14 items-center border-b border-dashboard-outline px-4 md:hidden">
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="md:ml-dashboard-rail lg:ml-dashboard-sidebar">
        <div className="mx-auto w-full max-w-dashboard-content space-y-6 px-dashboard-gutter pt-6 lg:pt-10">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-5 w-48 max-w-full" />
          </div>
          <Skeleton className="h-52 w-full rounded-dashboard-panel" />
          <Skeleton className="h-72 w-full rounded-dashboard-panel" />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 h-16 border-t border-dashboard-outline bg-dashboard-surface md:hidden" />
    </SkeletonGroup>
  )
}
