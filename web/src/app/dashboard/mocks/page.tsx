import { MocksRouteClient } from "@/components/dashboard/dashboard-route-clients";

export const metadata = {
  title: "Assessments | Kanvise",
};

export default function MocksPage() {
  return (
    <div className="animate-in fade-in duration-500">
      <MocksRouteClient />
    </div>
  );
}
