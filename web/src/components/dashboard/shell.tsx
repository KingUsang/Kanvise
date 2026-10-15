"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import {
  canAccessDashboardPath,
  type DashboardCapabilities,
} from "@/config/dashboard-navigation";
import { useDashboardSession } from "@/lib/dashboard-session";

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    first_name: string;
    last_name: string;
    role: string;
  };
  setupRequired?: boolean;
}

export function DashboardShell({
  children,
  user,
  setupRequired = false,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sessionQuery = useDashboardSession(!setupRequired);
  const capabilities: DashboardCapabilities = setupRequired
    ? { isAdmin: true, isTutor: false, setupRequired: true }
    : sessionQuery.data?.capabilities || { isAdmin: false, isTutor: false };
  const canAccessCurrentPath = canAccessDashboardPath(pathname, capabilities);

  React.useEffect(() => {
    if (!setupRequired && sessionQuery.isSuccess && !canAccessCurrentPath)
      router.replace("/dashboard?notice=not-authorised");
  }, [canAccessCurrentPath, router, sessionQuery.isSuccess, setupRequired]);

  if (!setupRequired && sessionQuery.isPending) {
    return (
      <div className="min-h-screen bg-[#f5f3f2] p-4 sm:p-6" aria-label="Loading dashboard">
        <div className="mx-auto flex max-w-[1440px] animate-pulse gap-6">
          <div className="hidden h-[calc(100vh-3rem)] w-64 rounded-2xl bg-[#e7e3e1] lg:block" />
          <div className="min-w-0 flex-1 space-y-5">
            <div className="h-14 rounded-2xl bg-white" />
            <div className="h-28 rounded-2xl bg-white" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="h-44 rounded-2xl bg-white" />
              <div className="h-44 rounded-2xl bg-white" />
              <div className="h-44 rounded-2xl bg-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!setupRequired && sessionQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3f2] p-6 font-sans text-center text-sm text-[#474551]">
        <div>
          <p>We could not open your workspace.</p>
          <button
            type="button"
            onClick={() => void sessionQuery.refetch()}
            className="mt-3 font-semibold text-[#2e2877] underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (sessionQuery.isSuccess && !canAccessCurrentPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3f2] font-sans text-[#474551]">
        Redirecting you to an available dashboard…
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-dashboard-page font-sans">
      <Sidebar capabilities={capabilities} />
      <TopBar user={user} capabilities={capabilities} />
      <MobileBottomNav capabilities={capabilities} />

      {/* Main Content Area */}
      <main className="md:ml-[280px] pt-16 min-h-dvh flex flex-col">
        <div className="w-full flex-1 p-dashboard-page-mobile pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-dashboard-page-desktop">
          {children}
        </div>
      </main>
    </div>
  );
}
