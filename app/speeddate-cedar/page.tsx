"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Pause,
  Settings,
  MessageSquare,
  Heart,
  X,
  Clock,
  AlertCircle,
  CheckCircle,
  Bot,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { CedarCopilot } from "cedar-os";
import { FloatingCedarChat } from "@/src/cedar/components/chatComponents/FloatingCedarChat";
import { HumanInTheLoopIndicator } from "@/src/cedar/components/chatInput/HumanInTheLoopIndicator";
import { CommandBar } from "@/src/cedar/components/CommandBar/CommandBar";
import Link from "next/link";

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  age: number;
  height: string;
  school: string;
  interests: string[];
  bio: string;
  relationship_type: string;
}

interface AgentAction {
  id: string;
  type: "swipe" | "message" | "wait";
  target_user_id: string;
  target_user_name: string;
  action: string;
  status: "pending" | "completed" | "waiting_for_user";
  timestamp: Date;
  reasoning?: string;
}

interface AgentStats {
  total_swipes: number;
  matches_made: number;
  messages_sent: number;
  waiting_for_user: number;
}

interface AgentMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  status: string;
  created_at: string;
  matched_user: {
    id: string;
    full_name: string;
    age: number;
    location: string;
    bio: string;
    avatar_url: string | null;
    interests: string[];
  };
  waiting_for_user?: boolean;
}

export default function SpeeddateCedarPage() {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [agentStats, setAgentStats] = useState<AgentStats>({
    total_swipes: 0,
    matches_made: 0,
    messages_sent: 0,
    waiting_for_user: 0,
  });
  const [recentActions, setRecentActions] = useState<AgentAction[]>([]);
  const [agentMatches, setAgentMatches] = useState<AgentMatch[]>([]);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserPreferences();
      loadAgentStats();
      loadRecentActions();
      loadAgentMatches();
    }
  }, [user]);

  const loadUserPreferences = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (data) {
        setUserPreferences(data);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  };

  const loadAgentStats = async () => {
    try {
      const supabase = createClient();

      // Get total swipes
      const { count: swipeCount } = await supabase
        .from("agent_actions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user?.id)
        .eq("type", "swipe");

      // Get matches made
      const { count: matchCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`);

      // Get messages sent
      const { count: messageCount } = await supabase
        .from("agent_actions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user?.id)
        .eq("type", "message");

      // Get waiting for user
      const { count: waitingCount } = await supabase
        .from("agent_actions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user?.id)
        .eq("status", "waiting_for_user");

      setAgentStats({
        total_swipes: swipeCount || 0,
        matches_made: matchCount || 0,
        messages_sent: messageCount || 0,
        waiting_for_user: waitingCount || 0,
      });
    } catch (error) {
      console.error("Error loading agent stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActions = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agent_actions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        setRecentActions(
          data.map((action) => ({
            ...action,
            timestamp: new Date(action.created_at),
          }))
        );
      }
    } catch (error) {
      console.error("Error loading recent actions:", error);
    }
  };

  const loadAgentMatches = async () => {
    try {
      const supabase = createClient();

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
        return;
      }

      // Deduplicate matches and get the other user's profile
      const uniqueMatches = new Map();

      for (const match of data || []) {
        const otherUserId =
          match.user1_id === user?.id ? match.user2_id : match.user1_id;
        const otherUserProfile =
          match.user1_id === user?.id
            ? match.user2_profile
            : match.user1_profile;

        // Check if agent is waiting for user input on this match
        const { data: waitingAction } = await supabase
          .from("agent_actions")
          .select("*")
          .eq("user_id", user?.id)
          .eq("target_user_id", otherUserId)
          .eq("status", "waiting_for_user")
          .single();

        // Only add if we haven't seen this user before
        if (!uniqueMatches.has(otherUserId)) {
          uniqueMatches.set(otherUserId, {
            ...match,
            matched_user: otherUserProfile,
            waiting_for_user: !!waitingAction,
          });
        }
      }

      setAgentMatches(Array.from(uniqueMatches.values()));
    } catch (error) {
      console.error("Error loading agent matches:", error);
    }
  };

  const toggleAgent = async () => {
    if (isActive) {
      // Stop agent
      setIsActive(false);
    } else {
      // Start agent
      setIsActive(true);
      await startAgent();
    }
  };

  const startAgent = async () => {
    try {
      const response = await fetch("/api/agent/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id,
          preferences: userPreferences,
        }),
      });

      if (response.ok) {
        // Start polling for updates and running the agent
        const interval = setInterval(async () => {
          if (!isActive) {
            clearInterval(interval);
            return;
          }

          // Run the agent to send messages
          try {
            await fetch("/api/agent/run", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: user?.id,
              }),
            });
          } catch (error) {
            console.error("Error running agent:", error);
          }

          // Update the UI
          await loadAgentStats();
          await loadRecentActions();
          await loadAgentMatches();
        }, 10000); // Run every 10 seconds

        return () => clearInterval(interval);
      }
    } catch (error) {
      console.error("Error starting agent:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "waiting_for_user":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "swipe":
        return <Heart className="w-4 h-4 text-red-500" />;
      case "message":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case "wait":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Bot className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading agent...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CedarCopilot
      llmProvider={{
        provider: "openai",
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || "",
      }}
    >
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            🚀 Cedar-OS Speeddate Agent
          </h1>
          <p className="text-muted-foreground">
            Your AI dating assistant powered by Cedar-OS - now with advanced
            chat capabilities
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="actions">Recent Actions</TabsTrigger>
            <TabsTrigger value="chat">AI Chat</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Agent Control */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Agent Control
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isActive ? "bg-green-500" : "bg-gray-400"
                        }`}
                      ></div>
                      <span className="font-medium">
                        {isActive ? "Agent Active" : "Agent Inactive"}
                      </span>
                    </div>
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? "Running" : "Stopped"}
                    </Badge>
                    {agentStats.waiting_for_user > 0 && (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">
                          {agentStats.waiting_for_user} waiting for input
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowChat(!showChat)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {showChat ? "Hide Chat" : "Show Chat"}
                    </Button>
                    <Button
                      onClick={toggleAgent}
                      variant={isActive ? "destructive" : "default"}
                      className="flex items-center gap-2"
                    >
                      {isActive ? (
                        <>
                          <Pause className="w-4 h-4" />
                          Stop Agent
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Start Agent
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {agentStats.total_swipes}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Swipes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {agentStats.matches_made}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Matches Made
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {agentStats.messages_sent}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Messages Sent
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {agentStats.waiting_for_user}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Waiting for You
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Agent Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Agent Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Matching Criteria</h4>
                    <div className="flex flex-wrap gap-2">
                      {userPreferences?.interests?.map((interest: string) => (
                        <Badge key={interest} variant="outline">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Relationship Type</h4>
                    <Badge variant="secondary">
                      {userPreferences?.relationship_type}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Agent Behavior</h4>
                    <p className="text-sm text-muted-foreground">
                      The agent will swipe right on users with matching
                      interests and send casual conversation starters. It will
                      wait for your input on important decisions like expressing
                      serious interest or answering personal questions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Agent Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                {agentMatches.length === 0 ? (
                  <div className="text-center py-8">
                    <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      No matches yet
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Start the agent to begin finding matches for you!
                    </p>
                    <Button
                      onClick={toggleAgent}
                      disabled={isActive}
                      className="flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start Agent
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agentMatches.map((match) => (
                      <Card
                        key={match.id}
                        className="hover:shadow-lg transition-all duration-200"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="w-12 h-12">
                              <AvatarImage
                                src={match.matched_user?.avatar_url || ""}
                                alt={match.matched_user?.full_name}
                              />
                              <AvatarFallback>
                                {match.matched_user?.full_name?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">
                                  {match.matched_user?.full_name}
                                </h4>
                                {match.waiting_for_user && (
                                  <AlertCircle
                                    className="w-4 h-4 text-yellow-500"
                                    title="Waiting for your input"
                                  />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {match.matched_user?.age} •{" "}
                                {match.matched_user?.location}
                              </p>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {match.matched_user?.bio || "No bio provided"}
                          </p>

                          <div className="flex flex-wrap gap-1 mb-3">
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

                          {/* Waiting for User Indicator */}
                          {match.waiting_for_user && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-3">
                              <div className="flex items-center gap-2 text-yellow-800">
                                <AlertCircle className="w-3 h-3" />
                                <span className="text-xs font-medium">
                                  Waiting for your input
                                </span>
                              </div>
                            </div>
                          )}

                          <Button asChild className="w-full" size="sm">
                            <Link href={`/user-chat/${match.id}`}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              {match.waiting_for_user
                                ? "Respond Now"
                                : "Start Chat"}
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Agent Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {recentActions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No actions yet. Start the agent to begin!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {recentActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          {getActionIcon(action.type)}
                          {getStatusIcon(action.status)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{action.action}</span>
                            <Badge variant="outline">{action.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {action.target_user_name} •{" "}
                            {action.timestamp.toLocaleString()}
                          </p>
                          {action.reasoning && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {action.reasoning}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Agent Chat</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 border rounded-lg p-4">
                  <p className="text-center text-muted-foreground">
                    Chat with your AI dating agent to get insights, ask
                    questions, or get help with your dating strategy.
                  </p>
                  <div className="mt-4">
                    <FloatingCedarChat />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Agent Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Message Frequency</h4>
                    <p className="text-sm text-muted-foreground">
                      How often the agent should send messages to matches
                    </p>
                    <div className="mt-2">
                      <Badge variant="outline">Every 2-4 hours</Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Swipe Strategy</h4>
                    <p className="text-sm text-muted-foreground">
                      Agent will swipe right on users with at least one matching
                      interest
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Wait for User</h4>
                    <p className="text-sm text-muted-foreground">
                      Agent will pause and wait for your input when:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc">
                      <li>Expressing serious romantic interest</li>
                      <li>Answering personal questions about values/goals</li>
                      <li>Making plans to meet in person</li>
                      <li>Any question the AI is uncertain about</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Command Bar for quick actions */}
        <CommandBar open={false} contents={{ groups: [] }} />
      </div>
    </CedarCopilot>
  );
}
