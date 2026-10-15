"use client";

import { ClassesWorkspace } from "@/components/dashboard/schedule/classes-workspace";
import { MocksManagementClient } from "@/components/dashboard/mocks/mocks-management-client";
import { CentreTimetableClient } from "@/components/dashboard/timetable/centre-timetable-client";
import { ClassWorkspaceClient } from "@/components/dashboard/classes/class-workspace-client";
import { useDashboardSession } from "@/lib/dashboard-session";

function RouteLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading page">
      <div className="h-7 w-48 rounded bg-[#e9e6e5]" />
      <div className="h-4 w-80 max-w-full rounded bg-[#f1eeee]" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-44 rounded-2xl border border-dashboard-outline bg-white" />
        <div className="h-44 rounded-2xl border border-dashboard-outline bg-white" />
      </div>
    </div>
  );
}

function RouteError({
  query,
}: {
  query: ReturnType<typeof useDashboardSession>;
}) {
  return (
    <div className="rounded-xl border border-[#ba1a1a]/20 bg-white p-6 text-center text-sm text-[#ba1a1a]">
      <p>
        {query.error instanceof Error
          ? query.error.message
          : "This workspace could not load."}
      </p>
      <button
        type="button"
        className="mt-3 font-semibold underline"
        onClick={() => void query.refetch()}
      >
        Try again
      </button>
    </div>
  );
}

export function ScheduleRouteClient() {
  const query = useDashboardSession();
  if (query.isPending) return <RouteLoading />;
  if (query.isError) return <RouteError query={query} />;
  return (
    <ClassesWorkspace
      capabilities={query.data.capabilities}
      user={query.data.user}
    />
  );
}

export function MocksRouteClient() {
  const query = useDashboardSession();
  if (query.isPending) return <RouteLoading />;
  if (query.isError) return <RouteError query={query} />;
  return (
    <MocksManagementClient
      capabilities={query.data.capabilities}
      user={query.data.user}
    />
  );
}

export function TimetableRouteClient() {
  const query = useDashboardSession();
  if (query.isPending) return <RouteLoading />;
  if (query.isError) return <RouteError query={query} />;
  return <CentreTimetableClient />;
}

export function ClassWorkspaceRouteClient({ classId }: { classId: string }) {
  const query = useDashboardSession();
  if (query.isPending) return <RouteLoading />;
  if (query.isError) return <RouteError query={query} />;
  return (
    <ClassWorkspaceClient
      classId={classId}
      token={query.data.token}
      viewerId={query.data.user.id}
      isTutor={query.data.capabilities.isTutor && !query.data.capabilities.isAdmin}
      canManageStudents={query.data.capabilities.isAdmin}
      canManageClass={query.data.capabilities.isAdmin}
      canManageTutors={query.data.capabilities.isAdmin && query.data.capabilities.organisationType === 'centre'}
    />
  );
}
