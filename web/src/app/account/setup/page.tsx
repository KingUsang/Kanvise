"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AvatarBuilder, AvatarConfig } from "@/components/avatar/AvatarBuilder";
import { Loader2, CheckCircle2, User, ArrowRight, Info } from "lucide-react";

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
        <Loader2 className="animate-spin text-kv-blue w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-kv-soft relative font-sans text-kv-dark">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-5 overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 border-[40px] border-kv-blue rounded-full blur-3xl"></div>
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 border-[60px] border-kv-brown rounded-full blur-3xl"></div>
      </div>

      {/* Main Container */}
      <main className="w-full max-w-[640px] bg-white shadow-[0px_4px_20px_rgba(61,61,61,0.08)] rounded-2xl overflow-hidden z-10 animate-fade-up">
        {/* Header / Logo Section */}
        <div className="bg-kv-blue p-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Kanvise</h1>
          <p className="text-kv-blue-100 font-semibold text-xs uppercase tracking-widest mt-2 text-white/80">
            Account Setup
          </p>
        </div>

        {/* 2-Step Indicator */}
        <nav className="flex w-full bg-gray-50 border-b border-gray-100">
          <div className="flex-1 py-4 text-center text-kv-blue border-b-2 border-transparent flex items-center justify-center gap-2 opacity-60">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Account Created</span>
          </div>
          <div className="flex-1 py-4 text-center text-kv-brown border-b-2 border-kv-brown flex items-center justify-center gap-2">
            <User className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Profile Setup</span>
          </div>
        </nav>

        {/* Content Area */}
        <div className="p-8 md:p-10 space-y-8">
          <header className="text-center mb-2">
            <h2 className="text-2xl font-bold text-kv-blue">Welcome, {profile?.first_name}!</h2>
            <p className="text-sm text-gray-500 mt-2">
              Let's personalize your Kanvise profile before you join your institution.
            </p>
          </header>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-8">
            
            {/* Avatar Builder Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Digital Identity</h3>
                <span className="text-[10px] bg-kv-soft text-kv-blue px-2 py-1 rounded font-bold uppercase">Avatar</span>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden">
                {/* Embedded Avatar Builder */}
                <AvatarBuilder config={avatarConfig} onChange={handleAvatarChange} />
              </div>
            </div>

            {/* Bio Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">About You</h3>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold uppercase">Optional</span>
              </div>
              <div className="relative">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell your peers a little bit about yourself..."
                  className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-xl font-medium focus:ring-0 focus:border-kv-blue focus:outline-none transition-all min-h-[120px] resize-y placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-4">
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
                    <span>Complete Setup & Join</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              <p className="text-center mt-6 text-xs text-gray-400">
                By joining, you agree to our <a href="#" className="text-kv-blue font-bold hover:underline">Terms of Service</a>
              </p>
            </div>
          </form>
        </div>

        {/* Support Footer */}
        <footer className="bg-gray-50 p-4 flex justify-between items-center px-8 border-t border-gray-100">
          <div className="flex items-center gap-2 text-gray-500">
            <Info className="w-4 h-4" />
            <span className="text-xs font-semibold">Need help setting up?</span>
          </div>
          <button className="text-kv-blue text-xs font-bold uppercase tracking-wider hover:text-kv-brown transition-colors">
            Contact Support
          </button>
        </footer>
      </main>
    </div>
  );
}
