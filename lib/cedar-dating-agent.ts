import { createClient } from "@/lib/supabase/client";

export interface DatingAgentConfig {
  userId: string;
  preferences: {
    interests: string[];
    relationship_type: string;
    age?: number;
    bio?: string;
  };
}

export class CedarDatingAgent {
  private config: DatingAgentConfig;
  private supabase: any;

  constructor(config: DatingAgentConfig) {
    this.config = config;
    this.supabase = createClient();
  }

  async getAgentContext(): Promise<string> {
    const { data: recentActions } = await this.supabase
      .from("agent_actions")
      .select("*")
      .eq("user_id", this.config.userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: matches } = await this.supabase
      .from("matches")
      .select(
        `
        *,
        user1:profiles!matches_user1_id_fkey(*),
        user2:profiles!matches_user2_id_fkey(*)
      `
      )
      .or(
        `user1_id.eq.${this.config.userId},user2_id.eq.${this.config.userId}`
      );

    const context = `
You are an AI dating assistant helping a user with their dating strategy. Here's the current context:

User Profile:
- Interests: ${this.config.preferences.interests?.join(", ") || "Not specified"}
- Relationship Type: ${
      this.config.preferences.relationship_type || "Not specified"
    }
- Age: ${this.config.preferences.age || "Not specified"}
- Bio: ${this.config.preferences.bio || "No bio provided"}

Recent Agent Actions:
${
  recentActions
    ?.map((action: any) => `- ${action.action} (${action.status})`)
    .join("\n") || "No recent actions"
}

Current Matches: ${matches?.length || 0}

Your role is to:
1. Help the user understand their dating progress
2. Suggest improvements to their profile or strategy
3. Answer questions about their matches and conversations
4. Provide insights about dating patterns and success rates
5. Help with conversation starters and responses

Be helpful, encouraging, and provide actionable advice. Focus on building genuine connections and helping the user find meaningful relationships.
    `;

    return context.trim();
  }

  async getWaitingActions(): Promise<any[]> {
    const { data } = await this.supabase
      .from("agent_actions")
      .select("*")
      .eq("user_id", this.config.userId)
      .eq("status", "waiting_for_user")
      .order("created_at", { ascending: false });

    return data || [];
  }

  async getRecentMatches(): Promise<any[]> {
    const { data } = await this.supabase
      .from("matches")
      .select(
        `
        *,
        user1:profiles!matches_user1_id_fkey(*),
        user2:profiles!matches_user2_id_fkey(*)
      `
      )
      .or(`user1_id.eq.${this.config.userId},user2_id.eq.${this.config.userId}`)
      .order("created_at", { ascending: false })
      .limit(10);

    return data || [];
  }

  async getConversationSuggestions(matchId: string): Promise<string[]> {
    const { data: messages } = await this.supabase
      .from("messages")
      .select("*")
      .or(
        `sender_id.eq.${this.config.userId},receiver_id.eq.${this.config.userId}`
      )
      .order("created_at", { ascending: false })
      .limit(10);

    // Get the other user's profile
    const { data: match } = await this.supabase
      .from("matches")
      .select(
        `
        *,
        user1:profiles!matches_user1_id_fkey(*),
        user2:profiles!matches_user2_id_fkey(*)
      `
      )
      .eq("id", matchId)
      .single();

    if (!match) return [];

    const otherUser =
      match.user1_id === this.config.userId ? match.user2 : match.user1;

    // Generate conversation suggestions based on their profile and recent messages
    const suggestions = [
      `Hey ${otherUser.full_name}! I noticed you're into ${
        otherUser.interests?.[0] || "interesting hobbies"
      }. What's your favorite thing about it?`,
      `I'd love to hear more about your experience with ${
        otherUser.school || "your studies"
      }. What are you studying?`,
      `Your bio mentions ${
        otherUser.bio?.split(" ").slice(0, 3).join(" ") ||
        "some interesting things"
      }. Tell me more!`,
      `What's the most exciting thing you've done recently?`,
      `I'm curious about your thoughts on ${
        this.config.preferences.interests?.[0] || "shared interests"
      }. What draws you to it?`,
    ];

    return suggestions.slice(0, 3);
  }

  async getDatingInsights(): Promise<string> {
    const { data: actions } = await this.supabase
      .from("agent_actions")
      .select("*")
      .eq("user_id", this.config.userId);

    const { data: matches } = await this.supabase
      .from("matches")
      .select("*")
      .or(
        `user1_id.eq.${this.config.userId},user2_id.eq.${this.config.userId}`
      );

    const totalSwipes =
      actions?.filter((a: any) => a.type === "swipe").length || 0;
    const totalMatches = matches?.length || 0;
    const matchRate =
      totalSwipes > 0 ? ((totalMatches / totalSwipes) * 100).toFixed(1) : "0";

    const insights = `
📊 Your Dating Analytics:
• Total Swipes: ${totalSwipes}
• Matches Made: ${totalMatches}
• Match Rate: ${matchRate}%
    • Messages Sent: ${
      actions?.filter((a: any) => a.type === "message").length || 0
    }
    • Waiting for Input: ${
      actions?.filter((a: any) => a.status === "waiting_for_user").length || 0
    }

💡 Insights:
${
  totalMatches > 0
    ? `• You're doing well with a ${matchRate}% match rate!`
    : `• Consider updating your profile or expanding your interests to increase matches.`
}
${
  actions?.filter((a: any) => a.status === "waiting_for_user").length > 0
    ? `• You have ${
        actions.filter((a: any) => a.status === "waiting_for_user").length
      } conversations waiting for your input.`
    : `• Great job staying on top of your conversations!`
}
    `;

    return insights.trim();
  }

  async readAndRespondToMatch(matchId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Get the match details
      const { data: match, error: matchError } = await this.supabase
        .from("matches")
        .select(
          `
          *,
          user1_profile:profiles!matches_user1_id_fkey(*),
          user2_profile:profiles!matches_user2_id_fkey(*)
        `
        )
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        return { success: false, error: "Match not found" };
      }

      const otherUser =
        match.user1_id === this.config.userId
          ? match.user2_profile
          : match.user1_profile;

      // Get the most recent message from the other person
      const { data: recentMessages, error: messagesError } = await this.supabase
        .from("user_messages")
        .select("*")
        .eq("match_id", matchId)
        .eq("sender_id", otherUser.id)
        .eq("receiver_id", this.config.userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (messagesError) {
        return { success: false, error: "Error fetching messages" };
      }

      let responseMessage: string;

      if (!recentMessages || recentMessages.length === 0) {
        // Chat is empty, send greeting
        responseMessage = "hi, nice to meet you!";
      } else {
        // Generate appropriate response based on their message
        const theirMessage = recentMessages[0].content;
        responseMessage = await this.generateContextualResponse(
          theirMessage,
          otherUser
        );
      }

      return { success: true, message: responseMessage };
    } catch (error) {
      console.error("Error reading and responding to match:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async generateContextualResponse(
    theirMessage: string,
    otherUser: any
  ): Promise<string> {
    try {
      const prompt = `Generate a natural, engaging response to this message from a dating app match.

Their message: "${theirMessage}"

Your profile:
- Interests: ${this.config.preferences.interests?.join(", ") || "Not specified"}
- Bio: ${this.config.preferences.bio || "No bio"}

Their profile:
- Name: ${otherUser.full_name}
- Interests: ${otherUser.interests?.join(", ") || "Not specified"}
- Bio: ${otherUser.bio || "No bio"}

Generate a response that:
1. Directly addresses what they said
2. Shows genuine interest and engagement
3. Asks a follow-up question or adds to the conversation
4. Is natural and conversational (not robotic)
5. Keeps it under 100 characters
6. Matches the tone of their message

Be authentic and engaging. Don't be overly formal or use dating app clichés.`;

      // Note: This would need OpenAI integration in a real implementation
      // For now, return a simple response
      return "That's interesting! Tell me more.";
    } catch (error) {
      console.error("Error generating contextual response:", error);
      return "That's interesting! Tell me more.";
    }
  }
}
