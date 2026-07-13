"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Building } from "lucide-react";

export default function AdminSchoolSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [schoolName, setSchoolName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth/login");
      return;
    }

    const honoApiUrl = process.env.NEXT_PUBLIC_HONO_API_URL || "http://localhost:8787";

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
          address,
          contact_email: contactEmail,
          contact_phone: contactPhone,
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create school.");
      }

      // Re-fetch the session or refresh the token to get the new school_id in the JWT
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
         console.error("Failed to refresh session, might need to re-login:", refreshError);
      }

      // Once created, redirect to the real admin dashboard
      router.push("/dashboard/admin");
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
          <h1 className="text-3xl font-bold text-kv-dark">Create Your School</h1>
          <p className="text-gray-500 mt-2">
            Let&apos;s set up your tutorial centre&apos;s profile on Kanvise.
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
                School Name *
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
                Public URL Slug *
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
              <p className="text-xs text-gray-400 mt-1.5">This will be your centre&apos;s public web address.</p>
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
                placeholder="Briefly describe your tutorial centre..."
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-4">
            <h3 className="font-bold text-kv-dark">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="contactEmail">
                  Contact Email *
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
              </div>
              <div>
                <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="contactPhone">
                  Contact Phone
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all"
                  placeholder="+234 800 000 0000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="address">
                Physical Address
              </label>
              <input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all"
                placeholder="123 Education Lane, Lagos"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kv-blue hover:bg-kv-blue/90 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm disabled:opacity-70"
            >
              {loading ? <><Loader2 className="animate-spin mr-2" size={18} /> Creating...</> : "Create School"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
