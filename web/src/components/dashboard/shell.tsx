"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast as sonnerToast } from "sonner";
import {
  canAccessDashboardPath,
  deniedReason,
  type DashboardCapabilities,
} from "@/config/dashboard-navigation";
import { getApiUrl } from "@/config/api";
import { changelog } from "@/content/changelog";
import {
  AccountSwitcherError,
  switchAccountOnServer,
  useAccountMemberships,
} from "@/components/account/account-switcher";
import { ErrorState, PageLoadingState } from "@/components/dashboard/async-states";
import { NotAvailable } from "@/components/shell/not-available";
import { SearchProvider, SearchTrigger } from "@/components/shell/search-palette";
import { ShellFrame } from "@/components/shell/shell-frame";
import type { ShellAccount, ShellActions, ShellData } from "@/components/shell/types";
import { clearActiveAccountId } from "@/lib/account-preference";
import { loginHref } from "@/lib/auth-continuation";
import { authenticatedApiFetch, SESSION_ENDED_EVENT } from "@/lib/authenticated-fetch";
import { useDashboardSession } from "@/lib/dashboard-session";
import { fetchSearch } from "@/lib/search";
import { getPendingUploadCount } from "@/lib/pending-uploads";
import { detachBrowserPushOnLogout } from "@/lib/push-notifications";
import { rememberAccountSwitch, takeAccountSwitch } from "@/lib/shell-preferences";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    first_name: string;
    last_name: string;
    role: string;
    email?: string;
  };
  setupRequired?: boolean;
}

const links = {
  helpUrl: process.env.NEXT_PUBLIC_HELP_URL || undefined,
  changelogUrl: process.env.NEXT_PUBLIC_CHANGELOG_URL || undefined,
  changelog,
};

async function loadUngradedQuizCount() {
  const response = await authenticatedApiFetch(`${getApiUrl()}/mocks/ungraded-count`);
  if (!response.ok) throw new Error("Could not load the marking count");
  const body = await response.json().catch(() => null);
  const count = Number(body?.data?.count);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/**
 * Loads what the shell shows (capabilities, accounts, the marking count),
 * decides whether the page may be shown, and renders ShellFrame.
 */
export function DashboardShell({
  children,
  user,
  setupRequired = false,
}: DashboardShellProps) {
  const pathname = usePathname() || "/dashboard";
  const queryClient = useQueryClient();
  const sessionQuery = useDashboardSession(!setupRequired);
  const memberships = useAccountMemberships(!setupRequired);
  const ungraded = useQuery({
    queryKey: ["dashboard-ungraded-quizzes"],
    queryFn: loadUngradedQuizCount,
    enabled: !setupRequired && sessionQuery.isSuccess,
    staleTime: 60_000,
    retry: 1,
  });
  const [signedOut, setSignedOut] = React.useState(false);
  const signingOutRef = React.useRef(false);

  React.useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT" && !signingOutRef.current) setSignedOut(true);
    });
    const onSessionEnded = () => {
      if (!signingOutRef.current) setSignedOut(true);
    };
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    };
  }, []);

  // Switching accounts reloads the dashboard; say where the person is now.
  React.useEffect(() => {
    const name = takeAccountSwitch();
    if (name) toast.success(`Now in ${name}.`);
  }, []);

  const session = sessionQuery.data;
  const fallbackCapabilities: DashboardCapabilities = {
    isAdmin: user.role === "admin",
    isTutor: user.role === "tutor",
  };
  const capabilities: DashboardCapabilities = setupRequired
    ? { isAdmin: true, isTutor: false, setupRequired: true }
    : session?.capabilities || fallbackCapabilities;
  const loading = !setupRequired && !session && sessionQuery.isPending;
  const failed = !setupRequired && !session && sessionQuery.isError;

  const firstName = session?.user.first_name || user.first_name;
  const lastName = session?.user.last_name || user.last_name;
  const selected = memberships.selected;
  const accounts: ShellAccount[] = (memberships.data || []).map((membership) => ({
    id: membership.school_id,
    name: membership.school?.name || "Tutoring account",
    role: membership.role,
    logoUrl: membership.school_id === selected?.school_id ? session?.account.logo_url : null,
  }));
  const accountName = session?.account.name || selected?.school?.name || null;

  const shellData: ShellData = {
    person: {
      id: session?.user.id || "",
      name: [firstName, lastName].filter(Boolean).join(" ") || "Your account",
      email: session?.user.email || user.email || "",
      photoUrl: session?.user.photo_url ?? null,
    },
    capabilities,
    account: accountName
      ? { id: selected?.school_id ?? null, name: accountName, logoUrl: session?.account.logo_url ?? null }
      : null,
    accounts,
    badges: { ungradedQuizzes: ungraded.isSuccess ? ungraded.data : null },
    loading,
  };

  const actions: ShellActions = {
    switchAccount: async (account) => {
      try {
        await switchAccountOnServer(account.id);
        rememberAccountSwitch(account.name);
        await queryClient.cancelQueries();
        queryClient.clear();
        // A full reload, so nothing from the previous account stays in memory (SH-07).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/dashboard");
      } catch (error) {
        if (error instanceof AccountSwitcherError && error.code === "SESSION_EXPIRED") {
          setSignedOut(true);
          return;
        }
        sonnerToast.error(
          error instanceof AccountSwitcherError
            ? error.userMessage
            : "We couldn't switch tutoring accounts. Try again.",
        );
      }
    },
    signOut: async () => {
      signingOutRef.current = true;
      try {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        await detachBrowserPushOnLogout(sessionData.session?.access_token);
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        clearActiveAccountId();
        // A full reload clears every cached query from the signed-in session.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/auth/login";
      } catch (error) {
        signingOutRef.current = false;
        throw error;
      }
    },
    sendFeedback: async (message) => {
      const response = await authenticatedApiFetch(`${getApiUrl()}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "feature", description: message, page_url: window.location.pathname }),
      });
      if (!response.ok) throw new Error("Feedback was not sent");
    },
    getPendingUploadCount,
  };

  const allowed = canAccessDashboardPath(pathname, capabilities);
  let content: React.ReactNode = children;
  if (failed) {
    content = <ErrorState size="card" onRetry={() => void sessionQuery.refetch()} />;
  } else if (!allowed && !loading) {
    content = <NotAvailable reason={deniedReason(pathname, capabilities)} independent={capabilities.organisationType === "independent"} />;
  } else if (!allowed && loading) {
    // A tutor is never an admin, so admin-only pages can be refused at once.
    // Anyone else waits for their real access before the page code runs.
    content = user.role === "tutor"
      ? <NotAvailable reason={deniedReason(pathname, fallbackCapabilities)} />
      : <PageLoadingState label="Loading this page" />;
  }

  // Search needs an account; a new admin setting up their agency has none yet.
  const searchReady = !setupRequired && !failed;
  const frame = (
    <ShellFrame
      shellData={shellData}
      actions={actions}
      links={links}
      signedOut={signedOut}
      signInHref={loginHref({ redirect: pathname })}
      onSignOutStart={() => { signingOutRef.current = true; }}
      searchSlot={searchReady ? (rail) => <SearchTrigger variant="sidebar" rail={rail} /> : undefined}
      phoneSearchSlot={searchReady ? <SearchTrigger variant="phone" /> : undefined}
    >
      {content}
    </ShellFrame>
  );

  return (
    <SearchProvider capabilities={capabilities} search={fetchSearch} enabled={searchReady}>
      {frame}
    </SearchProvider>
  );
}
