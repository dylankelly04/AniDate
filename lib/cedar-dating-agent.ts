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
}
