import { Suspense } from "react";
import { SignedInDashboardLayout } from "@/components/dashboard/signed-in-layout";
import { ShellFirstPaintSkeleton } from "@/components/shell/first-paint-skeleton";

/**
 * The sign-in check (SignedInDashboardLayout) waits on Supabase Auth. Wrapping it in Suspense lets
 * the skeleton stream at once instead of a blank page until that call returns
 * (16 R-08).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ShellFirstPaintSkeleton />}>
      <SignedInDashboardLayout>{children}</SignedInDashboardLayout>
    </Suspense>
  );
}
