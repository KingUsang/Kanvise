import { cache } from "react";
import { getApiUrl } from "@/config/api";

export type StudentClass = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "completed" | "cancelled";
  started_at: string | null;
  ended_at: string | null;
  course_id: string;
  course: { id: string; name: string } | null;
  tutor: { id: string; first_name: string; last_name: string } | null;
};

export const getStudentClasses = cache(async (accessToken: string): Promise<StudentClass[]> => {
  const response = await fetch(`${getApiUrl()}/live-classes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Failed to load student classes");
  return (await response.json()).data;
});
