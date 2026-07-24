import { cache } from "react";
import { getApiUrl } from "@/config/api";

export type StudentDashboardData = {
  student: { first_name: string; last_name: string };
  school: { name: string } | null;
  capabilities?: { hasCentreLearning: boolean; hasMarketplaceAccess: boolean };
  marketplace?: { mocks_owned: number; attempts_in_progress: number };
  course_count: number;
  next_class: null | { id: string; title: string; course_name: string; scheduled_at: string; duration_minutes: number; status: string };
  upcoming_classes: Array<{ id: string; title: string; course_name: string; scheduled_at: string }>;
  assignments_due: Array<{ id: string; title: string; course_name: string; deadline_at: string }>;
  recent_updates: Array<{ id: string; type: "assignment" | "material" | "mock"; title: string; course_name: string; occurred_at: string; href: string }>;
};

export const getStudentDashboard = cache(async (accessToken: string): Promise<StudentDashboardData> => {
  const response = await fetch(`${getApiUrl()}/dashboard/student`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Failed to load student dashboard");
  return (await response.json()).data;
});
