import { ClassWorkspaceRouteClient } from "@/components/dashboard/dashboard-route-clients";

export default async function ClassWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClassWorkspaceRouteClient classId={id} />;
}
