"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { soundManager } from "@/lib/sounds";
import { emailService } from "@/lib/email-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Send, ArrowLeft, MessageCircle, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HorizontalSuggestions } from "@/components/ui/horizontal-suggestions";
import { generateRealPersonSuggestions } from "@/lib/ai-assistant-service";

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  status: string;
  created_at: string;
  matched_user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export default function UserChatPage() {
  const { user } = useAuth();
  const params = useParams();
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (user && matchId) {
      fetchMatchAndMessages();
    }
  }, [user, matchId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMatchAndMessages = async () => {
    setLoading(true);
    setError("");

    try {
      // First, get the match details
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          `
          *,
          matched_user:profiles!matches_user2_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `
        )
        .eq("id", matchId)
        .eq("status", "accepted")
        .single();

      if (matchError || !matchData) {
        setError("Match not found or not accepted");
        return;
      }

      // If user is user2, get user1's profile instead
      let matchedUser = matchData.matched_user;
      if (matchData.user2_id === user?.id) {
        const { data: user1Profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", matchData.user1_id)
          .single();

        if (!profileError && user1Profile) {
          matchedUser = user1Profile;
        }
      }

      setMatch({
        ...matchData,
        matched_user: matchedUser,
      });

      // Then, get the messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("user_messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error("Error fetching messages:", messagesError);
        setError(`Failed to load messages: ${messagesError.message}`);
        return;
      }

      setMessages(messagesData || []);

      // Play sound for new messages received
      if (messagesData && messagesData.length > 0) {
        const newMessages = messagesData.filter(
          (msg) => msg.receiver_id === user?.id && !msg.is_read
        );
        if (newMessages.length > 0) {
          console.log("Playing message received sound...");
          soundManager.playMessageReceived();
        }
      }

      // Mark messages as read
      if (messagesData && messagesData.length > 0) {
        const unreadMessages = messagesData.filter(
          (msg) => msg.receiver_id === user?.id && !msg.is_read
        );

        if (unreadMessages.length > 0) {
          const messageIds = unreadMessages.map((msg) => msg.id);
          await supabase
            .from("user_messages")
            .update({ is_read: true })
            .in("id", messageIds);
        }
      }
    } catch (err) {
      console.error("Exception in fetchMatchAndMessages:", err);
      setError("Failed to load chat");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !match) return;

    setSending(true);

    try {
      const receiverId =
        match.user1_id === user.id ? match.user2_id : match.user1_id;

      const { data, error } = await supabase
        .from("user_messages")
        .insert({
          match_id: matchId,
          sender_id: user.id,
          receiver_id: receiverId,
          content: newMessage.trim(),
          message_type: "text",
        })
        .select()
        .single();

      if (error) {
        console.error("Error sending message:", error);
        setError("Failed to send message");
        return;
      }

      setMessages((prev) => [...prev, data]);
      setNewMessage("");
      console.log("Playing message sent sound...");
      soundManager.playMessageSent();

      // Send email notification to the receiver
      if (match?.matched_user) {
        emailService.sendNewMessageNotification(
          receiverId,
          user?.email || "",
          match.matched_user.full_name,
          user?.user_metadata?.full_name || user?.email || "Someone",
          newMessage.trim().substring(0, 50) +
            (newMessage.trim().length > 50 ? "..." : "")
        );
      }
    } catch (err) {
      console.error("Exception in sendMessage:", err);
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!user) return [];

    try {
      // Get user profile for context
      const { data: profile } = await supabase
        .from("profiles")
        .select("interests, bio")
        .eq("id", user.id)
        .single();

      const result = await generateRealPersonSuggestions(messages, {
        interests: profile?.interests || [],
        personality: profile?.bio || "",
      });

      if (result.success && result.suggestions) {
        return result.suggestions;
      } else {
        console.error("Failed to generate suggestions:", result.error);
        return [];
      }
    } catch (error) {
      console.error("Error generating suggestions:", error);
      return [];
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setNewMessage(suggestion);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading chat...</p>
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
            <Button asChild>
              <Link href="/matches">Back to Matches</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Match not found</p>
            <Button asChild>
              <Link href="/matches">Back to Matches</Link>
            </Button>
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/matches">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage
                  src={match.matched_user?.avatar_url || ""}
                  alt={match.matched_user?.full_name}
                />
                <AvatarFallback>
                  {match.matched_user?.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold">
                  {match.matched_user?.full_name}
                </h1>
                <p className="text-sm text-muted-foreground">Online</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/matches">
                <User className="w-4 h-4 mr-2" />
                Matches
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="container mx-auto px-4 py-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Chat Area */}
            <div className="flex-1">
              <Card className="h-[calc(100vh-200px)] flex flex-col">
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No messages yet</p>
                      <p className="text-sm text-muted-foreground">
                        Start the conversation!
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender_id === user?.id
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.sender_id === user?.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.sender_id === user?.id
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </CardContent>

                {/* Message Input */}
                <CardHeader className="border-t">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      disabled={sending}
                    />
                    <Button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </CardHeader>
              </Card>
            </div>

            {/* AI Suggestions Panel */}
            <div className="w-full lg:w-96 flex flex-col space-y-4">
              <Card className="bg-background/80 backdrop-blur-sm border-border/50 flex flex-col relative min-h-[240px]">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-pink-700 mb-2">
                        AI Assistant
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ask Ani for messaging tips!
                      </p>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <HorizontalSuggestions
                        onSuggestionSelect={handleSuggestionSelect}
                        onGenerateSuggestions={handleGenerateSuggestions}
                        disabled={sending}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </CardContent>

                {/* Anime Girl Image */}
                <div className="absolute bottom-0 right-0 w-40 h-40 pointer-events-none">
                  <img
                    src="/ani.png"
                    alt="Ani - AI Assistant"
                    className="w-full h-full object-contain object-bottom-right"
                  />
                </div>
              </Card>

              {/* Suggestions Box - Outside the main AI assistant panel */}
              <div id="suggestions-container"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
