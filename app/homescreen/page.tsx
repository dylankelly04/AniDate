"use client";

import { Button } from "@/components/ui/button";
import {
  Heart,
  User,
  MessageCircle,
  Users,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClientOnly } from "@/hooks/use-client-only";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CompactXPBar } from "@/components/ui/xp-bar";

export default function HomescreenPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const mounted = useClientOnly();
  const supabase = createClient();

  const [profile, setProfile] = useState<{
    aura_points: number;
    level: number;
    total_aura_earned: number;
  } | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("aura_points, level, total_aura_earned")
        .eq("id", user?.id)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Show loading state until component is mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/cute-anime-landscape.jpg')",
        }}
      />

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AniDate</span>
          </div>

          {/* Profile Section */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome back, {user?.user_metadata?.full_name || user?.email}
            </span>

            {/* Profile Button */}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </Button>

            {/* Settings Button */}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </Button>

            {/* Sign Out Button */}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
                Welcome to AniDate
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ready to practice your dating skills? Choose your adventure below.
            </p>
          </div>

          {/* Main Action Cards */}
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* AI Practice Card */}
            <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl p-8 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    AI Practice
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Chat with anime characters
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground mb-6">
                Practice your conversation skills with AI anime characters.
                Build confidence before connecting with real people.
              </p>
              <Button className="w-full" size="lg" asChild>
                <Link href="/characters">
                  Start AI Practice
                  <MessageCircle className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* Real Connections Card */}
            <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl p-8 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    Real Connections
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Connect with real people
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground mb-6">
                Meet real people through beautiful anime filters. Make genuine
                connections in a comfortable environment.
              </p>
              <Button className="w-full" size="lg" variant="secondary" asChild>
                <Link href="/discover">
                  Find Matches
                  <Users className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* Ani2 - AI Assistant mascot */}
            <div className="absolute -top-40 right-0 hidden lg:block">
              <img
                src="/ani2.png"
                alt="Ani - AI Assistant"
                className="w-40 h-40 object-contain opacity-80"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-base"
              asChild
            >
              <Link href="/matches">
                <Users className="w-5 h-5 mr-2" />
                View Matches
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-base"
              asChild
            >
              <Link href="/mystery">
                <Sparkles className="w-5 h-5 mr-2" />
                Mystery Mode
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-base"
              asChild
            >
              <Link href="/speeddate-cedar">
                <Heart className="w-5 h-5 mr-2" />
                Speeddate Mode
              </Link>
            </Button>
          </div>

          {/* Aura Points Section */}
          {profile && (
            <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Your Aura Progress</h3>
              </div>
              <CompactXPBar
                currentXP={profile.aura_points}
                level={profile.level}
                className="mb-4"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">
                    {profile.aura_points.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Current Aura
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-secondary">
                    {profile.level}
                  </div>
                  <div className="text-xs text-muted-foreground">Level</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-accent">
                    {profile.total_aura_earned.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Earned
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-24 relative z-10">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Heart className="w-4 h-4" />
            <span className="text-sm">Made for HackGT '25, with Love</span>
            <Heart className="w-4 h-4" />
          </div>
        </div>
      </footer>
    </div>
  );
}
