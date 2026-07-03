"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AvatarBuilder, AvatarConfig } from "@/components/avatar/AvatarBuilder";
import { Loader2 } from "lucide-react";

export default function AccountSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  
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
    face_shape: "Oval"
  });

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }
      setSessionToken(session.access_token);

      const honoApiUrl = process.env.NEXT_PUBLIC_HONO_API_URL || "http://localhost:8787";

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

  const handleSave = async () => {
    if (!sessionToken) return;
    setSaving(true);
    setError(null);

    const honoApiUrl = process.env.NEXT_PUBLIC_HONO_API_URL || "http://localhost:8787";

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

      // Save avatar via PUT /avatars/me
      await fetch(`${honoApiUrl}/avatars/me`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${sessionToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(avatarConfig)
      });

      // Redirect to correct dashboard based on role
      if (profile?.role === "admin") router.push("/dashboard/admin");
      else if (profile?.role === "tutor") router.push("/dashboard/tutor");
      else router.push("/dashboard/student");
      
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
        <Loader2 className="animate-spin text-kv-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kv-soft py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-kv-dark">Account Setup</h1>
          <p className="text-gray-500 mt-2">
            Welcome, {profile?.first_name}! Let's personalize your Kanvise profile.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-error rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {/* Bio Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-xl font-bold text-kv-dark mb-4">About You</h3>
          <div>
            <label className="block text-sm font-semibold text-kv-dark mb-2">Bio (Optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your peers a little bit about yourself..."
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue min-h-[100px] resize-y"
            />
          </div>
        </div>

        {/* Avatar Builder */}
        <AvatarBuilder config={avatarConfig} onChange={handleAvatarChange} />

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-kv-blue hover:bg-kv-blue/90 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 flex items-center shadow-sm disabled:opacity-70"
          >
            {saving ? <><Loader2 className="animate-spin mr-2" size={18} /> Saving...</> : "Complete Setup"}
          </button>
        </div>
      </div>
    </div>
  );
}
