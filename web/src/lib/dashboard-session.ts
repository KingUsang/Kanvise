"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/config/api";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { createClient } from "@/lib/supabase/client";
import type { DashboardCapabilities } from "@/config/dashboard-navigation";

export type DashboardSession = {
  token: string;
  capabilities: DashboardCapabilities;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    photo_url: string | null;
  };
  /** The selected account, for the shell's account card (SH-02). */
  account: { name: string | null; logo_url: string | null };
};

export const dashboardQueryKeys = {
  capabilities: ["dashboard-capabilities"] as const,
  summary: ["dashboard-summary"] as const,
  schedule: ["dashboard-schedule"] as const,
  timetable: ["dashboard-timetable"] as const,
};

/** Shared staff-dashboard session and capability query. */
export function useDashboardSession(enabled = true) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: dashboardQueryKeys.capabilities,
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<DashboardSession> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        throw new Error("Your session has ended. Please sign in again.");

      const response = await authenticatedFetch(
        supabase,
        `${getApiUrl()}/dashboard/capabilities`,
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Could not load your dashboard access");

      const data = body?.data;
      if (!data?.profile_id)
        throw new Error("Could not resolve your dashboard profile");
      return {
        token: session.access_token,
        capabilities: {
          isAdmin: Boolean(data.is_admin),
          isTutor: Boolean(data.is_tutor),
          organisationType:
            data.organisation_type === "independent" ? "independent" : "centre",
        },
        user: {
          id: data.profile_id,
          first_name: session.user.user_metadata?.first_name || "",
          last_name: session.user.user_metadata?.last_name || "",
          email: session.user.email || "",
          photo_url:
            typeof data.profile_photo_url === "string"
              ? data.profile_photo_url
              : null,
        },
        account: {
          name: typeof data.account_name === "string" ? data.account_name : null,
          logo_url:
            typeof data.account_logo_url === "string"
              ? data.account_logo_url
              : null,
        },
      };
    },
  });
}
