"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { getUserConversations } from "@/lib/ai-conversation-service";

export function DebugConversation() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConversations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await getUserConversations(user.id);
      console.log("Debug - User conversations:", result);
      setConversations(result.conversations || []);
    } catch (error) {
      console.error("Debug - Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Debug: AI Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please log in to debug conversations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Debug: AI Conversations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p>
            <strong>User ID:</strong> {user.id}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
        </div>

        <Button onClick={loadConversations} disabled={loading}>
          {loading ? "Loading..." : "Load My Conversations"}
        </Button>

        {conversations.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">
              Found {conversations.length} conversations:
            </h4>
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div key={conv.id} className="p-2 border rounded text-sm">
                  <p>
                    <strong>ID:</strong> {conv.id}
                  </p>
                  <p>
                    <strong>Character:</strong> {conv.character_name} (
                    {conv.character_series})
                  </p>
                  <p>
                    <strong>Created:</strong>{" "}
                    {new Date(conv.created_at).toLocaleString()}
                  </p>
                  <p>
                    <strong>Updated:</strong>{" "}
                    {new Date(conv.updated_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {conversations.length === 0 && !loading && (
          <p className="text-muted-foreground">No conversations found</p>
        )}
      </CardContent>
    </Card>
  );
}
