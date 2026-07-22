import { cache } from "react";
import { getApiUrl } from "@/config/api";

export type StudentAssignment = {
  id: string;
  title: string;
  description: string;
  deadline_at: string;
  created_at: string;
  attachment_file_name: string | null;
  attachment_download_url: string | null;
  course: { id: string; name: string } | null;
  submission: null | {
    id: string;
    file_name: string;
    submitted_at: string;
    is_late: boolean;
    score: number | null;
    feedback: string | null;
    reviewed_at: string | null;
    download_url: string;
  };
};

export const getStudentAssignments = cache(async (accessToken: string): Promise<StudentAssignment[]> => {
  const response = await fetch(`${getApiUrl()}/assignments/me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load student assignments");
  return (await response.json()).data;
});
