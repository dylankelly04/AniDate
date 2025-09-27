"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { soundManager } from "@/lib/sounds";
import { emailService } from "@/lib/email-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  X,
  Star,
  MapPin,
  Calendar,
  ArrowLeft,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  full_name: string;
  age: number;
  location: string;
  bio: string;
  gender: string;
  looking_for: string;
  interests: string[];
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  college: string | null;
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<Profile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfiles();
    }
  }, [user]);

  const fetchProfiles = async () => {
    try {
      console.log("🔍 Fetching profiles for user:", user?.id);

      // First get all profiles except current user
      const { data: allProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user?.id)
        .order("created_at", { ascending: false });

      if (profilesError) {
        console.error("❌ Error fetching profiles:", profilesError);
        setError(`Failed to load profiles: ${profilesError.message}`);
        return;
      }

      console.log("📋 All profiles found:", allProfiles?.length || 0);

      // Get existing matches to filter out already liked/rejected profiles
      const { data: existingMatches, error: matchesError } = await supabase
        .from("matches")
        .select("user2_id, status")
        .eq("user1_id", user?.id);

      if (matchesError) {
        console.error("❌ Error fetching matches:", matchesError);
        // Don't return here - just log the error and show all profiles
      }

      console.log("💔 Existing matches:", existingMatches?.length || 0);

      // Filter out profiles that have already been interacted with
      const excludedIds = existingMatches?.map((match) => match.user2_id) || [];
      const availableProfiles =
        allProfiles?.filter((profile) => !excludedIds.includes(profile.id)) ||
        [];

      console.log(
        "✅ Available profiles after filtering:",
        availableProfiles?.length || 0
      );
      console.log("🚫 Excluded profile IDs:", excludedIds);

      setProfiles(availableProfiles);
      setCurrentIndex(0); // Reset to first profile
    } catch (err) {
      console.error("💥 Exception in fetchProfiles:", err);
      setError("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (profileId: string) => {
    if (!user || !profileId) {
      console.log("❌ Missing user or profileId:", { user: !!user, profileId });
      return;
    }

    console.log("❤️ Liking profile:", profileId, "by user:", user.id);

    try {
      // Insert a match record with status 'pending' (user liked)
      const { data: insertData, error: insertError } = await supabase
        .from("matches")
        .insert({
          user1_id: user.id,
          user2_id: profileId,
          status: "pending",
        })
        .select();

      if (insertError) {
        console.error("❌ Error creating match:", insertError);
        // Still move to next profile even if there's an error
      } else {
        console.log("✅ Match created successfully:", insertData);
      }

      // Check if the other user already liked us (mutual match)
      const { data: mutualMatch, error: mutualError } = await supabase
        .from("matches")
        .select("*")
        .eq("user1_id", profileId)
        .eq("user2_id", user.id)
        .eq("status", "pending")
        .single();

      if (!mutualError && mutualMatch) {
        console.log("🎉 Mutual match found!");
        // It's a match! Update the existing mutual match to 'accepted'
        await supabase
          .from("matches")
          .update({ status: "accepted" })
          .eq("id", mutualMatch.id);

        // Delete the duplicate match record we just created
        await supabase
          .from("matches")
          .delete()
          .eq("user1_id", user.id)
          .eq("user2_id", profileId)
          .eq("status", "pending");

        console.log("🎉 It's a match!");
        soundManager.playMatch();

        // Send email notification to the matched user
        const matchedUser = profiles.find((p) => p.id === profileId);
        if (matchedUser) {
          emailService.sendNewMatchNotification(
            profileId,
            user?.email || "",
            matchedUser.full_name,
            user?.user_metadata?.full_name || user?.email || "Someone"
          );
        }

        setMatchedUser(matchedUser || null);
        setMatchId(mutualMatch.id);
        setShowMatchModal(true);
      } else {
        console.log("💔 No mutual match yet");
        soundManager.playLike();
      }

      removeCurrentProfile();
    } catch (err) {
      console.error("💥 Exception in handleLike:", err);
      removeCurrentProfile();
    }
  };

  const handlePass = async (profileId: string) => {
    if (!user || !profileId) {
      console.log("❌ Missing user or profileId:", { user: !!user, profileId });
      return;
    }

    console.log("❌ Passing profile:", profileId, "by user:", user.id);

    try {
      // Insert a match record with status 'rejected' (user passed)
      const { data: insertData, error } = await supabase
        .from("matches")
        .insert({
          user1_id: user.id,
          user2_id: profileId,
          status: "rejected",
        })
        .select();

      if (error) {
        console.error("❌ Error creating rejection:", error);
      } else {
        console.log("✅ Rejection created successfully:", insertData);
      }

      soundManager.playReject();
      removeCurrentProfile();
    } catch (err) {
      console.error("💥 Exception in handlePass:", err);
      removeCurrentProfile();
    }
  };

  const removeCurrentProfile = () => {
    console.log("🗑️ Removing current profile at index:", currentIndex);
    console.log("📊 Current profiles count:", profiles.length);

    setProfiles((prev) => {
      // Remove the current profile
      const newProfiles = prev.filter((_, index) => index !== currentIndex);

      console.log("📊 New profiles count after removal:", newProfiles.length);

      // Calculate the new index
      let newIndex = currentIndex;
      if (newIndex >= newProfiles.length) {
        newIndex = Math.max(0, newProfiles.length - 1);
      }

      console.log("📍 New index will be:", newIndex);

      // Update the index separately
      setCurrentIndex(newIndex);

      return newProfiles;
    });
  };

  const currentProfile = profiles[currentIndex];

  console.log("🎯 Current state:", {
    profilesCount: profiles.length,
    currentIndex,
    currentProfile: currentProfile?.full_name,
    currentProfileId: currentProfile?.id,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Finding amazing people...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchProfiles}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profiles.length === 0) {
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
            <Link href="/homescreen" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">AniDate</span>
            </Link>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/matches">
                  <Users className="w-4 h-4 mr-2" />
                  Matches
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/homescreen">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">No More Profiles</h1>
            <p className="text-muted-foreground mb-6">
              You've seen all available profiles! Check back later for new
              people or refresh to see if there are any updates.
            </p>
            <div className="space-y-2">
              <Button onClick={fetchProfiles}>Refresh Profiles</Button>
              <Button variant="outline" asChild>
                <Link href="/homescreen">Back to Home</Link>
              </Button>
            </div>
          </div>
        </main>
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
          <Link href="/homescreen" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AniDate</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/matches">
                <Users className="w-4 h-4 mr-2" />
                Matches
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/homescreen">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-md mx-auto">
          {/* Profile Card */}
          <Card className="mb-6">
            <CardHeader className="text-center">
              <div className="relative mx-auto w-32 h-32 mb-4">
                <Avatar className="w-full h-full">
                  <AvatarImage
                    src={currentProfile?.avatar_url || ""}
                    alt={currentProfile?.full_name}
                  />
                  <AvatarFallback className="text-2xl">
                    {currentProfile?.full_name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-2xl">
                {currentProfile?.full_name}
              </CardTitle>
              <div className="flex items-center justify-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{currentProfile?.age} years old</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{currentProfile?.location}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">About</h4>
                  <p className="text-sm text-muted-foreground">
                    {currentProfile?.bio || "No bio provided"}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentProfile?.interests?.map((interest) => (
                      <Badge key={interest} variant="secondary">
                        {interest}
                      </Badge>
                    )) || (
                      <span className="text-sm text-muted-foreground">
                        No interests listed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handlePass(currentProfile?.id)}
              className="w-16 h-16 rounded-full"
            >
              <X className="w-6 h-6" />
            </Button>

            <Button
              size="lg"
              onClick={() => handleLike(currentProfile?.id)}
              className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90"
            >
              <Heart className="w-6 h-6" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => handleLike(currentProfile?.id)} // Super like - same as like for now
              className="w-16 h-16 rounded-full"
            >
              <Star className="w-6 h-6" />
            </Button>
          </div>

          {/* Progress */}
          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              {profiles.length > 0
                ? `${currentIndex + 1} of ${profiles.length}`
                : "No profiles remaining"}
            </p>
          </div>
        </div>
      </main>

      {/* Match Modal */}
      <Dialog open={showMatchModal} onOpenChange={setShowMatchModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              🎉 It's a Match!
            </DialogTitle>
            <DialogDescription className="text-center">
              You and {matchedUser?.full_name} liked each other!
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="flex items-center space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage
                  src={user?.user_metadata?.avatar_url || ""}
                  alt="You"
                />
                <AvatarFallback>You</AvatarFallback>
              </Avatar>
              <Heart className="w-8 h-8 text-red-500" />
              <Avatar className="w-16 h-16">
                <AvatarImage
                  src={matchedUser?.avatar_url || ""}
                  alt={matchedUser?.full_name}
                />
                <AvatarFallback>
                  {matchedUser?.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex space-x-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowMatchModal(false)}
              >
                Keep Swiping
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
