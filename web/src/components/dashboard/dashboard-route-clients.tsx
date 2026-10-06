"use client";

import { ClassesWorkspace } from "@/components/dashboard/schedule/classes-workspace";
import { MocksManagementClient } from "@/components/dashboard/mocks/mocks-management-client";
import { CentreTimetableClient } from "@/components/dashboard/timetable/centre-timetable-client";
import { ClassWorkspaceClient } from "@/components/dashboard/classes/class-workspace-client";
import { useDashboardSession } from "@/lib/dashboard-session";

function RouteLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[18rem] items-center justify-center text-sm text-[#66616c]">
      Loading {label}…
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
  if (query.isPending) return <RouteLoading label="calendar" />;
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
  if (query.isPending) return <RouteLoading label="mocks" />;
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
  if (query.isPending) return <RouteLoading label="timetable" />;
  if (query.isError) return <RouteError query={query} />;
  return <CentreTimetableClient />;
}

export function ClassWorkspaceRouteClient({ classId }: { classId: string }) {
  const query = useDashboardSession();
  if (query.isPending) return <RouteLoading label="class workspace" />;
  if (query.isError) return <RouteError query={query} />;
  return (
    <ClassWorkspaceClient
      classId={classId}
      token={query.data.token}
      canManageStudents={query.data.capabilities.isAdmin}
    />
  );
}
