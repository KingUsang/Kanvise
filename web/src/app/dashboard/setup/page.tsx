"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Building } from "lucide-react";

export default function SchoolSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth/login");
      return;
    }

    const honoApiUrl = process.env.NEXT_PUBLIC_API_URL;

    try {
      const res = await fetch(`${honoApiUrl}/schools`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: schoolName,
          slug,
          description,
          contact_email: contactEmail,
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "We couldn't create your school. Please try again.");
      }

      // Refresh the session so the new school_id lands in the token
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error("Failed to refresh session, might need to re-login:", refreshError);
      }

      router.push("/dashboard");
      router.refresh();

    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kv-soft py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-kv-blue-rose/10 text-kv-blue rounded-full flex items-center justify-center mx-auto mb-4">
            <Building size={32} />
          </div>
          <h1 className="text-3xl font-bold text-kv-dark">Set up your school</h1>
          <p className="text-gray-500 mt-2">
            A few details to get your centre started. You can add your logo, banner and the rest later.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-error rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateSchool} className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="schoolName">
                School name *
              </label>
              <input
                id="schoolName"
                required
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  // auto-generate slug suggestion if slug is empty or matches previous name
                  if (!slug || slug === schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }
                }}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all"
                placeholder="e.g. BrightMinds Academy"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="slug">
                Your web address *
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  kanvise.ng/
                </span>
                <input
                  id="slug"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                  className="flex-1 px-4 py-2.5 rounded-none rounded-r-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all"
                  placeholder="brightminds"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">This is the link students will use to find your centre.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue min-h-[100px] resize-y"
                placeholder="Tell students what your centre is about..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="contactEmail">
                Contact email *
              </label>
              <input
                id="contactEmail"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all"
                placeholder="admin@brightminds.edu"
              />
              <p className="text-xs text-gray-400 mt-1.5">We'll use this for payment receipts and student enquiries.</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kv-blue hover:bg-kv-blue/90 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm disabled:opacity-70"
            >
              {loading ? <><Loader2 className="animate-spin mr-2" size={18} /> Creating...</> : "Create school"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
