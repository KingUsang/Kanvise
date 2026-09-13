"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AvatarBuilder, AvatarConfig } from "@/components/avatar/AvatarBuilder";
import { Loader2, ArrowRight, UserRound } from "lucide-react";
import { accountDashboardPath, optionalProfileChanged } from "@/lib/profile-setup";

export default function AccountSetupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Profile Data
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; role: string; bio?: string } | null>(null);
  const [bio, setBio] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Avatar Data
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    skin_tone: "#FAD6B1",
    hair_style: "Short",
    hair_colour: "#2b2b2b",
    face_shape: "Oval",
    outfit_colour: "#2563EB"
  });
  const [savedAvatarConfig, setSavedAvatarConfig] = useState<AvatarConfig>(avatarConfig);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }
      setSessionToken(session.access_token);

      const honoApiUrl = process.env.NEXT_PUBLIC_API_URL;

      try {
        // Fetch profile
        const profileRes = await fetch(`${honoApiUrl}/auth/me`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        });
        const profileData = await profileRes.json();
        if (profileData.user) {
          setProfile(profileData.user);
          if (profileData.user.bio) setBio(profileData.user.bio);
        }

        // Fetch avatar
        const avatarRes = await fetch(`${honoApiUrl}/avatars/me`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        });
        const avatarData = await avatarRes.json();
        if (avatarData.avatar) {
          setAvatarConfig(avatarData.avatar);
          setSavedAvatarConfig(avatarData.avatar);
        }
      } catch (err) {
        console.error("Failed to load account data:", err);
        setError("Failed to load your profile data.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  const handleAvatarChange = (key: keyof AvatarConfig, value: string) => {
    setAvatarConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;
    setSaving(true);
    setError(null);

    const honoApiUrl = process.env.NEXT_PUBLIC_API_URL;

    try {
      // Save bio via PATCH /auth/me
      if (bio !== profile?.bio) {
        await fetch(`${honoApiUrl}/auth/me`, {
          method: "PATCH",
          headers: { 
            "Authorization": `Bearer ${sessionToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ bio })
        });
      }

      if (JSON.stringify(avatarConfig) !== JSON.stringify(savedAvatarConfig)) {
        const avatarSaveRes = await fetch(`${honoApiUrl}/avatars/me`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${sessionToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(avatarConfig)
        });
        if (!avatarSaveRes.ok) throw new Error("Failed to save avatar");
      }

      // Redirect to correct dashboard based on role
      router.push(accountDashboardPath(profile?.role));
      
      router.refresh();
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("An error occurred while saving your profile.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kv-soft">
        <Loader2 className="animate-spin text-kv-blue w-10 h-10" />
      </div>
    );
  }

  const hasProfileChanges = optionalProfileChanged(bio, profile?.bio || "", avatarConfig, savedAvatarConfig);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-kv-soft relative font-sans text-kv-dark">
      {/* Main Container */}
      <main className="z-10 w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-[0px_4px_20px_rgba(61,61,61,0.08)] animate-fade-up">
        <div className="space-y-7 p-5 sm:p-8">
          <header>
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-kv-soft text-kv-blue"><UserRound className="h-5 w-5" /></div>
            <h1 className="text-2xl font-bold text-kv-blue">You’re ready, {profile?.first_name}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">Your account is set up. Continue to Kanvise now, or personalise your profile if you want.</p>
          </header>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSave}>
            <details className="rounded-xl border border-gray-200 bg-gray-50/60">
              <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-kv-blue marker:content-none">Personalise my profile <span className="font-normal text-gray-500">(optional)</span></summary>
              <div className="space-y-6 border-t border-gray-200 p-4 sm:p-5">
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
                  <AvatarBuilder config={avatarConfig} onChange={handleAvatarChange} />
                </div>
                <label className="block text-sm font-semibold text-gray-700">About you <span className="font-normal text-gray-500">(optional)</span>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short introduction" className="mt-2 min-h-[96px] w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-kv-blue" />
                </label>
              </div>
            </details>

            {/* CTA Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-kv-brown hover:bg-[#A85822] active:scale-[0.98] text-white font-semibold py-4 rounded-xl shadow-lg shadow-kv-brown/20 flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-70 group"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <span>{hasProfileChanges ? 'Save and continue' : 'Continue to dashboard'}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
