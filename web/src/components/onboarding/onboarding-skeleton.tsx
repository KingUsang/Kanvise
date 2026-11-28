import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * Shaped like the hello screen. Shown at once while the sign-in is checked
 * (app/onboarding/loading.tsx) and while the onboarding state loads (16 R-08).
 */
export function OnboardingSkeleton() {
  return (
    <SkeletonGroup label="Loading" className="min-h-dvh bg-dashboard-page">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <Skeleton className="h-7 w-28" />
      </div>
      <div className="mx-auto w-full max-w-[560px] space-y-4 px-4 pt-6">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-5 w-72 max-w-full" />
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton className="h-11 w-28" />
      </div>
    </SkeletonGroup>
  );
}
