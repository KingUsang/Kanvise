import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MockBuilderClient } from "@/components/dashboard/mocks/mock-builder-client";

export const metadata = {
  title: "Mock Builder | Kanvise",
};

export default async function MockBuilderPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    redirect("/login");
  }

  // The backend extracts user details from the token
  return <MockBuilderClient token={token} />;
}
