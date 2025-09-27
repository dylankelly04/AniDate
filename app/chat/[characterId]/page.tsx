"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ArrowLeft, Send, User, Bot, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useClientOnly } from "@/hooks/use-client-only";
import { useAuth } from "@/lib/auth-context";
import { addAuraPoints } from "@/lib/aura-service";
import {
  getOrCreateConversation,
  addMessage,
  getConversationForCharacter,
  type AIMessage,
} from "@/lib/ai-conversation-service-v2";
import { StarRating, CONNECTION_LEVELS } from "@/components/ui/star-rating";
import {
  generateCharacterResponse,
  convertMessagesToOpenAIFormat,
} from "@/lib/openai-service";
import { HorizontalSuggestions } from "@/components/ui/horizontal-suggestions";
import { generateAICharacterSuggestions } from "@/lib/ai-assistant-service";

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
  chat_prompt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mounted = useClientOnly();
  const { user } = useAuth();

  const [character, setCharacter] = useState<AnimeCharacter | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [connectionLevel, setConnectionLevel] = useState<number>(0);

  const characterId = params.characterId as string;

  useEffect(() => {
    if (characterId) {
      fetchCharacter();
    }
  }, [characterId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchCharacter = async () => {
    try {
      const { data, error } = await supabase
        .from("anime_characters")
        .select("*")
        .eq("id", characterId)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      setCharacter(data);

      // Load existing conversation if user is logged in
      if (user) {
        await loadConversation(data);
      } else {
        // Add welcome message for non-logged in users
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `Hello! I'm ${data.name} from ${data.series}. ${data.personality} How can I help you today?`,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching character:", error);
      toast.error("Character not found");
      router.push("/characters");
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (characterData: AnimeCharacter) => {
    if (!user) {
      console.log("No user found, skipping conversation load");
      return;
    }

    console.log(
      "Loading conversation for user:",
      user.id,
      "character:",
      characterId
    );

    try {
      const result = await getConversationForCharacter(user.id, characterId);
      console.log("Conversation result:", result);

      if (result.success && result.conversation) {
        const conversation = result.conversation;
        console.log(
          "Loading existing conversation with",
          conversation.messages.length,
          "messages"
        );
        // Load existing conversation
        setConversationId(conversation.id);
        setConnectionLevel(conversation.connection_level || 0);
        setMessages(
          conversation.messages.map((msg, index) => ({
            id: `${conversation.id}-${index}`,
            role: msg.role,
            content: msg.content,
            created_at: msg.timestamp,
          }))
        );
      } else {
        console.log("No existing conversation found, creating new one");
        // Create new conversation and add welcome message
        const convResult = await getOrCreateConversation(
          user.id,
          characterId,
          characterData.name,
          characterData.series
        );
        console.log("Create conversation result:", convResult);

        if (convResult.success && convResult.conversationId) {
          setConversationId(convResult.conversationId);
          console.log(
            "Created conversation with ID:",
            convResult.conversationId
          );

          // Add welcome message to database
          const welcomeMessage = `Hello! I'm ${characterData.name} from ${characterData.series}. ${characterData.personality} How can I help you today?`;
          const messageResult = await addMessage(
            convResult.conversationId,
            "assistant",
            welcomeMessage
          );
          console.log("Welcome message result:", messageResult);

          // Set welcome message in UI
          setMessages([
            {
              id: `${convResult.conversationId}-0`,
              role: "assistant",
              content: welcomeMessage,
              created_at: new Date().toISOString(),
            },
          ]);
        } else {
          console.error("Failed to create conversation:", convResult.error);
        }
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      // Fallback to welcome message
      setMessages([
        {
          id: "fallback-welcome",
          role: "assistant",
          content: `Hello! I'm ${characterData.name} from ${characterData.series}. ${characterData.personality} How can I help you today?`,
          created_at: new Date().toISOString(),
        },
      ]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !character) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: newMessage,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setSending(true);

    try {
      // Save user message to database if conversation exists
      if (conversationId) {
        console.log("Saving user message to conversation:", conversationId);
        const userMsgResult = await addMessage(
          conversationId,
          "user",
          newMessage
        );
        console.log("User message save result:", userMsgResult);
      } else {
        console.log("No conversation ID, skipping user message save");
      }

      // Award 1 aura point for sending a message
      if (user) {
        try {
          const result = await addAuraPoints(
            user.id,
            1,
            `Message to ${character.name}`
          );

          if (result.success && result.levelUp) {
            toast.success(`🎉 Level up! You're now level ${result.newLevel}!`, {
              duration: 5000,
            });
          }
        } catch (error) {
          console.error("Error awarding aura for message:", error);
        }
      }

      // Generate AI response using OpenAI
      const conversationHistory = convertMessagesToOpenAIFormat(messages);
      const aiResponse = await generateCharacterResponse(
        character.chat_prompt,
        conversationHistory,
        newMessage
      );

      let response: string;
      if (aiResponse.success && aiResponse.message) {
        response = aiResponse.message;
      } else {
        // Fallback to simulated response if OpenAI fails
        console.warn(
          "OpenAI failed, using fallback response:",
          aiResponse.error
        );
        response = await simulateAIResponse(newMessage, character);

        // Show error toast to user
        toast.error(
          `AI response failed: ${aiResponse.error || "Unknown error"}`
        );
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to database if conversation exists
      if (conversationId) {
        console.log(
          "Saving assistant message to conversation:",
          conversationId
        );
        const assistantMsgResult = await addMessage(
          conversationId,
          "assistant",
          response
        );
        console.log("Assistant message save result:", assistantMsgResult);

        // Update connection level based on new message count
        const newMessageCount = messages.length + 2; // +2 for user and assistant messages
        const newConnectionLevel =
          newMessageCount < 5
            ? 0
            : newMessageCount < 10
            ? 1
            : newMessageCount < 20
            ? 2
            : newMessageCount < 40
            ? 3
            : newMessageCount < 80
            ? 4
            : 5;
        setConnectionLevel(newConnectionLevel);
      } else {
        console.log("No conversation ID, skipping assistant message save");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const simulateAIResponse = async (
    userMessage: string,
    character: AnimeCharacter
  ): Promise<string> => {
    // Simulate API delay
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );

    // Simple response simulation based on character personality
    const responses = [
      `That's interesting. As ${character.name}, I would say that your perspective is quite unique.`,
      `Hmm, I see what you mean. In my experience from ${character.series}, things aren't always as they seem.`,
      `You know, that reminds me of something that happened in my world. Let me tell you about it...`,
      `I appreciate you sharing that with me. It's not often I get to have conversations like this.`,
      `That's a thoughtful question. Given my background, I'd have to say that it depends on the situation.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!character) return [];

    try {
      const result = await generateAICharacterSuggestions(
        character.name,
        character.personality,
        messages
      );

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

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading character...</p>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Character not found</p>
          <Button onClick={() => router.push("/characters")} className="mt-4">
            Back to Characters
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
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
              onClick={() => router.push("/characters?tab=discover")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Discover
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {character.avatar_url ? (
                  <img
                    src={character.avatar_url}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <h1 className="text-lg font-semibold">{character.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {character.series}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <StarRating level={connectionLevel} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {CONNECTION_LEVELS[
                      connectionLevel as keyof typeof CONNECTION_LEVELS
                    ]?.name || "Stranger"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AniDate</span>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="flex-1 container mx-auto px-4 py-6 relative z-10 flex flex-col">
        <div className="max-w-7xl mx-auto flex-1 flex flex-col">
          <div className="flex flex-col lg:flex-row gap-6 flex-1">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              <Card className="flex-1 bg-background/80 backdrop-blur-sm border-border/50 flex flex-col">
                <CardContent className="flex-1 flex flex-col p-0">
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            {character.avatar_url ? (
                              <img
                                src={character.avatar_url}
                                alt={character.name}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <Bot className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        )}

                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>

                        {message.role === "user" && (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}

                    {sending && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          {character.avatar_url ? (
                            <img
                              src={character.avatar_url}
                              alt={character.name}
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <Bot className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="bg-muted text-foreground rounded-lg px-4 py-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="border-t border-border/50 p-4">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={`Message ${character.name}...`}
                        disabled={sending}
                        className="flex-1"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        size="icon"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
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
