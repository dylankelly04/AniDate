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
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

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

export default function SpeeddatePage() {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [agentStats, setAgentStats] = useState<AgentStats>({
    total_swipes: 0,
    matches_made: 0,
    messages_sent: 0,
    waiting_for_user: 0,
  });
  const [recentActions, setRecentActions] = useState<AgentAction[]>([]);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserPreferences();
      loadAgentStats();
      loadRecentActions();
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
        // Start polling for updates
        const interval = setInterval(async () => {
          if (!isActive) {
            clearInterval(interval);
            return;
          }
          await loadAgentStats();
          await loadRecentActions();
        }, 5000);

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
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Speeddate Agent</h1>
        <p className="text-muted-foreground">
          Your AI dating assistant that swipes and messages on your behalf
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="actions">Recent Actions</TabsTrigger>
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
                </div>
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
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
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
                    The agent will swipe right on users with matching interests
                    and send casual conversation starters. It will wait for your
                    input on important decisions like expressing serious
                    interest or answering personal questions.
                  </p>
                </div>
              </div>
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
    </div>
  );
}
