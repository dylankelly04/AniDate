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
import { Heart, Send, ArrowLeft, MessageCircle, User, X, Eye, EyeOff, Video } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HorizontalSuggestions } from "@/components/ui/horizontal-suggestions";
import { generateRealPersonSuggestions } from "@/lib/ai-assistant-service";
import { ConversationPointsDisplay } from "@/components/ui/conversation-points-display";
import { conversationPointsService, VIDEO_CHAT_UNLOCK_POINTS } from "@/lib/conversation-points-service";
import { VideoCallModal } from "@/components/ui/video-call-modal";
import { ProfileModal } from "@/components/ui/profile-modal";

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
    original_avatar_url?: string | null;
    anime_avatar_url?: string | null;
    age?: number;
    bio?: string;
    location?: string;
    interests?: string[];
    college?: string;
    // Social Media Fields
    instagram_handle?: string | null;
    twitter_handle?: string | null;
    tiktok_handle?: string | null;
    discord_username?: string | null;
    snapchat_username?: string | null;
    // Additional Profile Fields
    relationship_status?: string | null;
    occupation?: string | null;
    height_ft?: number | null;
    height_in?: number | null;
    zodiac_sign?: string | null;
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
  const [conversationPoints, setConversationPoints] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFullSizeImage, setShowFullSizeImage] = useState(false);
  const [showOriginalImage, setShowOriginalImage] = useState(false);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    fromUserId: string;
    offer?: RTCSessionDescriptionInit;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const [previousMessageCount, setPreviousMessageCount] = useState(0);

  useEffect(() => {
    if (user && matchId) {
      fetchMatchAndMessages();
      
      // Set up polling for new messages every 2 seconds
      const interval = setInterval(() => {
        checkForNewMessages();
      }, 2000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [user, matchId]);

  useEffect(() => {
    // Only auto-scroll if user is near the bottom of the chat or if it's a new message from them
    const chatContainer = messagesEndRef.current?.parentElement;
    if (chatContainer) {
      const isNearBottom = chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 100;
      const isNewMessage = messages.length > previousMessageCount;
      const lastMessage = messages[messages.length - 1];
      const isOwnMessage = lastMessage?.sender_id === user?.id;
      
      // Auto-scroll if: user is near bottom, or they just sent a message, or it's the initial load
      if (isNearBottom || (isNewMessage && isOwnMessage) || messages.length <= 1) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
        setShowNewMessageIndicator(false);
      } else if (isNewMessage && !isOwnMessage) {
        // Show indicator if there's a new message from other user and user is scrolled up
        setShowNewMessageIndicator(true);
      }
    }
    
    // Update previous message count for next comparison
    setPreviousMessageCount(messages.length);
  }, [messages, user?.id]);

  // Refresh points whenever messages change
  useEffect(() => {
    console.log(`Messages array changed. Length: ${messages.length}`);
    if (messages.length > 0 && user && matchId) {
      // Use the conversation points service to calculate points properly (1 pt sent, 2 pts received)
      fetchConversationPoints();
    } else if (messages.length === 0) {
      setConversationPoints(0);
    }
  }, [messages, user, matchId]); // Changed from messages.length to messages to catch all changes

  // Debug: Track when conversationPoints state changes
  useEffect(() => {
    console.log(`conversationPoints state changed to: ${conversationPoints}`);
  }, [conversationPoints]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversationPoints = async () => {
    if (!user || !matchId) return;
    
    try {
      const points = await conversationPointsService.getConversationPoints(matchId, user.id);
      setConversationPoints(points);
    } catch (error) {
      console.error('Error fetching conversation points:', error);
    }
  };

  // Initial scroll to bottom when messages first load
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      setTimeout(() => {
        scrollToBottom();
      }, 200);
    }
  }, [loading]);

  const checkForNewMessages = async () => {
    if (!user || !matchId) return;

    try {
      const { data: messagesData, error } = await supabase
        .from("user_messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (error || !messagesData) return;

      const currentCount = messagesData.length;
      
      // If we have new messages and the count increased, play sound for new ones
      if (currentCount > previousMessageCount && previousMessageCount > 0) {
        const newMessages = messagesData.slice(previousMessageCount);
        const messagesForCurrentUser = newMessages.filter(
          msg => msg.receiver_id === user?.id && !msg.is_read
        );
        
        if (messagesForCurrentUser.length > 0) {
          console.log("New messages received, playing sound...");
          soundManager.playMessageReceived();
          
          // Mark new messages as read
          const messageIds = messagesForCurrentUser.map(msg => msg.id);
          await supabase
            .from("user_messages")
            .update({ is_read: true })
            .in("id", messageIds);
        }
      }

      setMessages(messagesData);
      setPreviousMessageCount(currentCount);
      
      // Update points immediately when new messages are received
      if (messagesData && messagesData.length > 0) {
        // Recalculate points with new system (1 pt sent, 2 pts received)
        setTimeout(async () => {
          await fetchConversationPoints();
        }, 100);
      }
    } catch (err) {
      console.error("Error checking for new messages:", err);
    }
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
              avatar_url,
              original_avatar_url,
              anime_avatar_url,
              age,
              bio,
              location,
              interests,
              college,
              instagram_handle,
              twitter_handle,
              tiktok_handle,
              discord_username,
              snapchat_username,
              relationship_status,
              occupation,
              height_ft,
              height_in,
              zodiac_sign
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
          .select("id, full_name, avatar_url, original_avatar_url, anime_avatar_url, age, bio, location, interests, college, instagram_handle, twitter_handle, tiktok_handle, discord_username, snapchat_username, relationship_status, occupation, height_ft, height_in, zodiac_sign")
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
      // Set initial message count (don't play sound on initial load)
      setPreviousMessageCount(messagesData?.length || 0);

      // Mark messages as read (but don't play sound on page load)
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
      
      // Fetch conversation points
      await fetchConversationPoints();
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

      console.log(`Before adding message: ${messages.length} messages`);
      setMessages((prev) => {
        const newMessages = [...prev, data];
        console.log(`After adding message: ${newMessages.length} messages`);
        return newMessages;
      });

      // Update points immediately after state update
      // Recalculate points with new system (1 pt sent, 2 pts received)
      console.log(`Updating points immediately after sending message`);
      console.log(`Current conversationPoints state before update: ${conversationPoints}`);
      setTimeout(async () => {
        await fetchConversationPoints();
        console.log(`Points recalculated after sending message`);
      }, 100);
      setNewMessage("");
      
      // Refocus the input and scroll to bottom after sending message
      setTimeout(() => {
        messageInputRef.current?.focus();
        scrollToBottom();
      }, 100);
      
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

      // Transform messages to the expected format
      const formattedMessages = messages.map(msg => ({
        role: msg.sender_id === user?.id ? 'user' : 'assistant',
        content: msg.content
      }));

      const result = await generateRealPersonSuggestions(formattedMessages, {
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
              <Avatar 
                className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => setShowFullSizeImage(true)}
              >
                <AvatarImage
                  src={
                    showOriginalImage && match.matched_user?.original_avatar_url
                      ? match.matched_user.original_avatar_url
                      : match.matched_user?.anime_avatar_url || match.matched_user?.avatar_url || ""
                  }
                  alt={match.matched_user?.full_name}
                />
                <AvatarFallback>
                  {match.matched_user?.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <button 
                  onClick={() => setShowProfileModal(true)}
                  className="font-semibold hover:text-primary transition-colors cursor-pointer"
                >
                  {match.matched_user?.full_name}
                </button>
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
                  
                  {/* New Message Indicator */}
                  {showNewMessageIndicator && (
                    <div className="sticky bottom-0 flex justify-center py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/10"
                        onClick={() => {
                          scrollToBottom();
                          setShowNewMessageIndicator(false);
                        }}
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        New message
                      </Button>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </CardContent>

                {/* Message Input */}
                <CardHeader className="border-t">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                      ref={messageInputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      disabled={sending}
                      autoFocus
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

            {/* Right Panel */}
            <div className="w-full lg:w-96 flex flex-col space-y-4">
              {/* Conversation Points - Now at the top */}
              {user && (
                <ConversationPointsDisplay
                  matchId={matchId}
                  userId={user.id}
                  points={conversationPoints}
                  onPointsUpdate={setConversationPoints}
                />
              )}

              {/* Video Call Button */}
              {user && match?.matched_user && conversationPoints >= 10 && (
                <Card className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <Video className="w-5 h-5 text-green-600" />
                        <h3 className="font-semibold text-green-700">Video Chat Unlocked!</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        You've earned enough points to start a video call
                      </p>
                      <Button 
                        onClick={() => setShowVideoCall(true)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Start Video Call
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Suggestions Panel */}
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

      {/* Profile Modal */}
      {match?.matched_user && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          user={match.matched_user}
          conversationPoints={conversationPoints}
        />
      )}

      {/* Full Size Image Modal */}
      {match?.matched_user && (
        <Dialog open={showFullSizeImage} onOpenChange={setShowFullSizeImage}>
          <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
            <div className="relative">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setShowFullSizeImage(false)}
              >
                <X className="w-4 h-4" />
              </Button>

              {/* Photo Toggle Button for Full Size */}
              {conversationPointsService.isFieldUnlocked(conversationPoints, 'real_photo') && 
               match.matched_user.original_avatar_url && 
               match.matched_user.anime_avatar_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-4 left-4 z-10 bg-black/50 hover:bg-black/70 text-white border-white/20"
                  onClick={() => setShowOriginalImage(!showOriginalImage)}
                >
                  {showOriginalImage ? (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      Anime
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      Real
                    </>
                  )}
                </Button>
              )}

              {/* Full Size Image */}
              <div className="flex items-center justify-center bg-black min-h-[60vh] max-h-[80vh]">
                <img
                  src={
                    showOriginalImage && match.matched_user.original_avatar_url
                      ? match.matched_user.original_avatar_url
                      : match.matched_user.anime_avatar_url || match.matched_user.avatar_url || ""
                  }
                  alt={match.matched_user.full_name}
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: '80vh' }}
                />
              </div>

              {/* Image Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="text-white text-center">
                  <h3 className="text-lg font-semibold">{match.matched_user.full_name}</h3>
                  {conversationPointsService.isFieldUnlocked(conversationPoints, 'real_photo') && 
                   match.matched_user.original_avatar_url && 
                   match.matched_user.anime_avatar_url && (
                    <p className="text-sm text-white/80 mt-1">
                      {showOriginalImage ? 'Real Photo' : 'Anime Version'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Video Call Modal */}
      {match?.matched_user && user && (
        <VideoCallModal
          isOpen={showVideoCall}
          onClose={() => setShowVideoCall(false)}
          matchId={matchId}
          userId={user.id}
          remoteUserId={match.matched_user.id}
          remoteUserName={match.matched_user.full_name}
        />
      )}

      {/* Incoming Call Modal */}
      {incomingCall && match?.matched_user && user && (
        <VideoCallModal
          isOpen={true}
          onClose={() => setIncomingCall(null)}
          matchId={matchId}
          userId={user.id}
          remoteUserId={incomingCall.fromUserId}
          remoteUserName={match.matched_user.full_name}
          isIncoming={true}
          incomingOffer={incomingCall.offer}
        />
      )}
    </div>
  );
}
