"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MessageCircle,
  ArrowLeft,
  Users,
  Calendar,
  MapPin,
} from "lucide-react";
import Link from "next/link";

interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  matched_user: {
    id: string;
    full_name: string;
    age: number;
    location: string;
    bio: string;
    avatar_url: string | null;
    interests: string[];
  };
}

export default function MatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchMatches();
    }
  }, [user]);

  const fetchMatches = async () => {
    setLoading(true);
    setError("");

    try {
      // Get matches where the current user is involved and status is 'accepted'
      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          *,
          user1_profile:profiles!matches_user1_id_fkey(
            id,
            full_name,
            age,
            location,
            bio,
            avatar_url,
            interests
          ),
          user2_profile:profiles!matches_user2_id_fkey(
            id,
            full_name,
            age,
            location,
            bio,
            avatar_url,
            interests
          )
        `
        )
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching matches:", error);
        setError(`Failed to load matches: ${error.message}`);
        return;
      }

      // Deduplicate matches and get the other user's profile
      const uniqueMatches = new Map();

      data?.forEach((match) => {
        const otherUserId =
          match.user1_id === user?.id ? match.user2_id : match.user1_id;
        const otherUserProfile =
          match.user1_id === user?.id
            ? match.user2_profile
            : match.user1_profile;

        // Only add if we haven't seen this user before
        if (!uniqueMatches.has(otherUserId)) {
          uniqueMatches.set(otherUserId, {
            ...match,
            matched_user: otherUserProfile,
          });
        }
      });

      setMatches(Array.from(uniqueMatches.values()));
    } catch (err) {
      console.error("Exception in fetchMatches:", err);
      setError("Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading your matches...</p>
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
            <Button onClick={fetchMatches}>Try Again</Button>
          </CardContent>
        </Card>
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
              <Link href="/discover">
                <Users className="w-4 h-4 mr-2" />
                Discover
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Your Matches</h1>
            <p className="text-muted-foreground">
              {matches.length} {matches.length === 1 ? "match" : "matches"}{" "}
              found
            </p>
          </div>

          {matches.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No matches yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start swiping to find your perfect match!
                </p>
                <Button asChild>
                  <Link href="/discover">
                    <Users className="w-4 h-4 mr-2" />
                    Start Discovering
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => (
                <Card
                  key={match.id}
                  className="hover:shadow-lg transition-all duration-200"
                >
                  <CardHeader className="text-center">
                    <div className="relative mx-auto w-20 h-20 mb-4">
                      <Avatar className="w-full h-full">
                        <AvatarImage
                          src={match.matched_user?.avatar_url || ""}
                          alt={match.matched_user?.full_name}
                        />
                        <AvatarFallback className="text-lg">
                          {match.matched_user?.full_name?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <CardTitle className="text-lg">
                      {match.matched_user?.full_name}
                    </CardTitle>
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{match.matched_user?.age}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{match.matched_user?.location}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {match.matched_user?.bio || "No bio provided"}
                        </p>
                      </div>

                      <div>
                        <div className="flex flex-wrap gap-1">
                          {match.matched_user?.interests
                            ?.slice(0, 3)
                            .map((interest) => (
                              <Badge
                                key={interest}
                                variant="secondary"
                                className="text-xs"
                              >
                                {interest}
                              </Badge>
                            ))}
                          {match.matched_user?.interests &&
                            match.matched_user.interests.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{match.matched_user.interests.length - 3}
                              </Badge>
                            )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
