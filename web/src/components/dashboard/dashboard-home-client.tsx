"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { QueryErrorState, QueryFailure } from "@/components/common/query-error-state";
import {
  DashboardHomeSkeleton,
  DashboardHomeView,
} from "@/components/dashboard/home/dashboard-home-view";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { getApiUrl } from "@/config/api";
import { createClient } from "@/lib/supabase/client";
import { dashboardQueryKeys, useDashboardSession } from "@/lib/dashboard-session";
import type { DashboardOverview } from "@/lib/dashboard-overview";

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
  } catch {
    return "Africa/Lagos";
  }
}

export function DashboardHomeClient() {
  const sessionQuery = useDashboardSession();
  const supabase = createClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [mineOnly, setMineOnly] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const overviewQuery = useQuery({
    queryKey: [...dashboardQueryKeys.summary, "overview", weekOffset, mineOnly],
    enabled: sessionQuery.isSuccess,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DashboardOverview> => {
      const params = new URLSearchParams({ tz: browserTimezone(), week: String(weekOffset) });
      if (mineOnly) params.set("mine", "1");
      const response = await authenticatedFetch(
        supabase,
        `${getApiUrl()}/dashboard/overview?${params.toString()}`,
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "We could not load your dashboard");
      return body.data as DashboardOverview;
    },
  });

  if (sessionQuery.isError || (overviewQuery.isError && !overviewQuery.data)) {
    const retry = sessionQuery.isError ? sessionQuery : overviewQuery;
    return (
      <QueryErrorState
        error={retry.error}
        fallback="We could not load your dashboard."
        retrying={retry.isFetching}
        onRetry={() => void retry.refetch()}
      />
    );
  }
  if (!sessionQuery.data || !overviewQuery.data) return <DashboardHomeSkeleton />;

  return (
    <div className="animate-in fade-in duration-300">
      <QueryFailure query={overviewQuery} />
      <DashboardHomeView
        overview={overviewQuery.data}
        firstName={sessionQuery.data.user.first_name}
        now={now}
        mineOnly={mineOnly}
        onMineOnlyChange={setMineOnly}
        onWeekChange={setWeekOffset}
      />
    </div>
  );
}
