"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  MessageCircle,
  ArrowLeft,
  User,
  Calendar,
  MapPin,
  Grid3X3,
  X,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useClientOnly } from "@/hooks/use-client-only";
import { useAuth } from "@/lib/auth-context";
import { getUserConversations } from "@/lib/ai-conversation-service-v2";

interface AnimeCharacter {
  id: string;
  name: string;
  series: string;
  age: number;
  gender: string;
  personality: string;
  backstory: string;
  interests: string[];
  avatar_url: string | null;
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<AnimeCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeries, setSelectedSeries] = useState<string>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedCharacters, setLikedCharacters] = useState<AnimeCharacter[]>([]);
  const [activeTab, setActiveTab] = useState<string>("discover");
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const mounted = useClientOnly();
  const { user } = useAuth();

  useEffect(() => {
    fetchCharacters();
  }, []);

  useEffect(() => {
    if (user && activeTab === "discover") {
      loadConversations();
    }
  }, [user, activeTab]);

  // Reload conversations when the page becomes visible (user comes back from chat)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && activeTab === "discover") {
        loadConversations();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, activeTab]);

  useEffect(() => {
    // Check for tab parameter in URL
    const tab = searchParams.get("tab");
    if (tab === "browse") {
      setActiveTab("browse");
    } else if (tab === "discover") {
      setActiveTab("discover");
    }
    // If no tab parameter, it will use the default "discover" state
  }, [searchParams]);

  const fetchCharacters = async () => {
    try {
      const { data, error } = await supabase
        .from("anime_characters")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCharacters(data || []);
    } catch (error) {
      console.error("Error fetching characters:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    if (!user) return;

    setConversationsLoading(true);
    try {
      const result = await getUserConversations(user.id);
      console.log("Conversations loaded:", result);
      if (result.success && result.conversations) {
        // Sort conversations by most recent first
        const sortedConversations = result.conversations.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setConversations(sortedConversations);
        console.log("Set conversations:", sortedConversations.length);
      } else {
        console.log("No conversations found or error:", result.error);
        setConversations([]);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  };

  const getUniqueSeries = () => {
    const series = characters.map((char) => char.series);
    return Array.from(new Set(series));
  };

  const filteredCharacters =
    selectedSeries === "all"
      ? characters
      : characters.filter((char) => char.series === selectedSeries);

  // Filter out characters that already have conversations
  const availableCharacters = filteredCharacters.filter((character) => {
    return !conversations.some((conv) => conv.character_id === character.id);
  });

  const currentCharacter = availableCharacters[currentIndex];

  const handlePass = (characterId: string) => {
    // Move to next character
    if (currentIndex < availableCharacters.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Reset to beginning if at end
      setCurrentIndex(0);
    }
  };

  const handleLike = (characterId: string) => {
    // Add character to liked list and move to next
    const character = availableCharacters.find(
      (char) => char.id === characterId
    );
    if (character && !likedCharacters.find((char) => char.id === characterId)) {
      setLikedCharacters((prev) => [...prev, character]);
    }
    handlePass(characterId);

    // Automatically open the chat for the liked character
    router.push(`/chat/${characterId}`);
  };

  const handleSuperLike = (characterId: string) => {
    // Same as like for now - could add special functionality later
    handleLike(characterId);
  };

  const handleStartChat = (characterId: string) => {
    // Navigate to chat with this character
    router.push(`/chat/${characterId}`);
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading anime characters...</p>
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
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/homescreen")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">AniDate</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Choose an anime character to chat with
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
                Meet Anime Characters
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Practice your conversation skills with your favorite anime
              characters. Each character has their own unique personality and
              backstory.
            </p>
          </div>

          {/* Tabs for different viewing modes */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="discover" className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Discover Mode
              </TabsTrigger>
              <TabsTrigger value="browse" className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" />
                Browse Characters
              </TabsTrigger>
            </TabsList>

            {/* Browse Mode (Current UI) */}
            <TabsContent value="browse" className="space-y-6">
              {/* Series Filter */}
              <div className="flex flex-wrap gap-2 justify-center mb-8">
                <Button
                  variant={selectedSeries === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSeries("all")}
                >
                  All Series
                </Button>
                {getUniqueSeries().map((series) => (
                  <Button
                    key={series}
                    variant={selectedSeries === series ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSeries(series)}
                  >
                    {series}
                  </Button>
                ))}
              </div>

              {/* Characters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCharacters.map((character) => (
                  <Card
                    key={character.id}
                    className="bg-background/80 backdrop-blur-sm border-border/50 hover:shadow-lg transition-all duration-200"
                  >
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {character.avatar_url ? (
                            <img
                              src={character.avatar_url}
                              alt={character.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {character.name}
                          </CardTitle>
                          <CardDescription>{character.series}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Character Info */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {character.age && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{character.age} years old</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{character.gender}</span>
                        </div>
                      </div>

                      {/* Personality */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">
                          Personality
                        </h4>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {character.personality}
                        </p>
                      </div>

                      {/* Interests */}
                      {character.interests &&
                        character.interests.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">
                              Interests
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {character.interests
                                .slice(0, 3)
                                .map((interest, index) => (
                                  <Badge
                                    key={index}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {interest}
                                  </Badge>
                                ))}
                              {character.interests.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{character.interests.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Chat Button */}
                      <Button
                        className="w-full"
                        onClick={() => router.push(`/chat/${character.id}`)}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chat with {character.name}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredCharacters.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No characters found for this series.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Discover Mode (Split Screen) */}
            <TabsContent value="discover" className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-muted-foreground">
                  Discover characters and start conversations
                </p>
              </div>

              {/* Split Screen Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
                {/* Left Side - Chat Log */}
                <div className="space-y-4">
                  {/* Conversations Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Your Conversations
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadConversations}
                      disabled={conversationsLoading}
                    >
                      {conversationsLoading ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Refresh"
                      )}
                    </Button>
                  </div>
                  {conversationsLoading ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                        <p className="text-sm text-muted-foreground">
                          Loading conversations...
                        </p>
                      </CardContent>
                    </Card>
                  ) : conversations.length > 0 ? (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {conversations.map((conversation) => {
                        const character = characters.find(
                          (char) => char.id === conversation.character_id
                        );
                        if (!character) return null;

                        const lastMessage =
                          conversation.messages &&
                          conversation.messages.length > 0
                            ? conversation.messages[
                                conversation.messages.length - 1
                              ]
                            : null;

                        return (
                          <Card
                            key={conversation.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() =>
                              handleStartChat(conversation.character_id)
                            }
                          >
                            <CardContent>
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {character.avatar_url ? (
                                    <img
                                      src={character.avatar_url}
                                      alt={character.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-5 h-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium truncate text-sm">
                                      {character.name}
                                    </h4>
                                    <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {character.series}
                                  </p>
                                  {lastMessage && (
                                    <div className="mt-0.5">
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        <span className="font-medium">
                                          {lastMessage.role === "user"
                                            ? "You: "
                                            : `${character.name}: `}
                                        </span>
                                        {lastMessage.content}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {new Date(
                                          lastMessage.timestamp
                                        ).toLocaleDateString()}{" "}
                                        at{" "}
                                        {new Date(
                                          lastMessage.timestamp
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <h4 className="font-medium mb-2">
                          No conversations yet
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Like characters on the right to start conversations
                          with them
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Your conversations will appear here once you start
                          chatting
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Side - Character Card */}
                <div className="flex flex-col items-center">
                  {currentCharacter ? (
                    <>
                      <Card className="mb-6">
                        <CardHeader className="text-center">
                          <div className="relative mx-auto w-32 h-32 mb-4">
                            {currentCharacter.avatar_url ? (
                              <img
                                src={currentCharacter.avatar_url}
                                alt={currentCharacter.name}
                                className="w-full h-full rounded-full object-cover border-2 border-border"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-muted flex items-center justify-center border-2 border-border">
                                <User className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <CardTitle className="text-2xl">
                            {currentCharacter.name}
                          </CardTitle>
                          <div className="flex items-center justify-center gap-4 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{currentCharacter.age} years old</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{currentCharacter.series}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">Personality</h4>
                              <p className="text-sm text-muted-foreground">
                                {currentCharacter.personality}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-medium mb-2">Interests</h4>
                              <div className="flex flex-wrap gap-2">
                                {currentCharacter.interests?.map((interest) => (
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
                          onClick={() => handlePass(currentCharacter.id)}
                          className="w-16 h-16 rounded-full"
                        >
                          <X className="w-6 h-6" />
                        </Button>

                        <Button
                          size="lg"
                          onClick={() => handleLike(currentCharacter.id)}
                          className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90"
                        >
                          <Heart className="w-6 h-6" />
                        </Button>

                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => handleSuperLike(currentCharacter.id)}
                          className="w-16 h-16 rounded-full"
                        >
                          <Star className="w-6 h-6" />
                        </Button>
                      </div>

                      {/* Progress */}
                      <div className="mt-4 text-center text-sm text-muted-foreground">
                        {currentIndex + 1} of {availableCharacters.length}{" "}
                        characters
                      </div>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                        <User className="w-16 h-16 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold mb-2">
                          No Characters Found
                        </h3>
                        <p className="text-muted-foreground">
                          Try adjusting your series filter to see more
                          characters.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
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
