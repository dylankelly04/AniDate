// Aura Points Service
// Handles aura points updates and calculations for AI chat sessions

import { createClient } from "@/lib/supabase/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { calculateAuraReward } from "@/lib/aura-utils";

export interface ChatSessionData {
  messageCount: number;
  conversationLength: number;
  quality?: number; // 0-1, will be determined by LLM evaluation
  characterId: string;
  characterName: string;
}

export interface AuraUpdateResult {
  success: boolean;
  oldAura: number;
  newAura: number;
  pointsAdded?: number;
  pointsSubtracted?: number;
  oldLevel: number;
  newLevel: number;
  levelUp?: boolean;
  levelDown?: boolean;
  reason: string;
  error?: string;
}

/**
 * Add aura points to a user's profile
 */
export async function addAuraPoints(
  userId: string,
  pointsToAdd: number,
  reason: string = "AI Chat Practice"
): Promise<AuraUpdateResult> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.rpc("add_aura_points", {
      user_id: userId,
      points_to_add: pointsToAdd,
      reason: reason,
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      oldAura: data.old_aura,
      newAura: data.new_aura,
      pointsAdded: data.points_added,
      oldLevel: data.old_level,
      newLevel: data.new_level,
      levelUp: data.level_up,
      reason: data.reason,
    };
  } catch (error) {
    console.error("Error adding aura points:", error);
    return {
      success: false,
      oldAura: 0,
      newAura: 0,
      pointsAdded: 0,
      oldLevel: 1,
      newLevel: 1,
      levelUp: false,
      reason,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Subtract aura points from a user's profile
 * Uses the existing add_aura_points function with negative values
 */
export async function subtractAuraPoints(
  userId: string,
  pointsToSubtract: number,
  reason: string = "Feature Usage"
): Promise<AuraUpdateResult> {
  // Use service role client for server-side RPC calls
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log("🔄 subtractAuraPoints called:", {
      userId,
      pointsToSubtract,
      reason,
    });

    // First check if user has enough points
    const { data: currentStats, error: statsError } = await supabase
      .from("profiles")
      .select("aura_points")
      .eq("id", userId)
      .single();

    if (statsError) {
      console.error("❌ Error fetching current stats:", statsError);
      throw statsError;
    }

    const currentAura = currentStats?.aura_points || 0;
    console.log("📊 Current aura points:", currentAura);

    if (currentAura < pointsToSubtract) {
      console.log("❌ Insufficient aura points:", {
        currentAura,
        required: pointsToSubtract,
      });
      return {
        success: false,
        oldAura: currentAura,
        newAura: currentAura,
        pointsSubtracted: 0,
        oldLevel: 1,
        newLevel: 1,
        levelDown: false,
        reason,
        error: "Insufficient aura points",
      };
    }

    // Use add_aura_points with negative value to subtract
    console.log("🔄 Calling add_aura_points RPC with negative value...");
    const { data, error } = await supabase.rpc("add_aura_points", {
      user_id: userId,
      points_to_add: -pointsToSubtract, // Negative value to subtract
      reason: reason,
    });

    if (error) {
      console.error("❌ RPC Error:", error);
      throw error;
    }

    console.log("✅ RPC Success:", data);

    return {
      success: true,
      oldAura: data.old_aura,
      newAura: data.new_aura,
      pointsSubtracted: pointsToSubtract,
      oldLevel: data.old_level,
      newLevel: data.new_level,
      levelDown: data.new_level < data.old_level,
      reason: data.reason,
    };
  } catch (error) {
    console.error("Error subtracting aura points:", error);
    return {
      success: false,
      oldAura: 0,
      newAura: 0,
      pointsSubtracted: 0,
      oldLevel: 1,
      newLevel: 1,
      levelDown: false,
      reason,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Award aura points for completing an AI chat session
 */
export async function awardAuraForChatSession(
  userId: string,
  chatData: ChatSessionData
): Promise<AuraUpdateResult> {
  const pointsToAward = calculateAuraReward(chatData);
  const reason = `Chat with ${chatData.characterName}`;

  return await addAuraPoints(userId, pointsToAward, reason);
}

/**
 * Get user's current aura points and level
 */
export async function getUserAuraStats(userId: string) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("aura_points, level, total_aura_earned")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      auraPoints: data.aura_points || 0,
      level: data.level || 1,
      totalAuraEarned: data.total_aura_earned || 0,
    };
  } catch (error) {
    console.error("Error fetching aura stats:", error);
    return {
      success: false,
      auraPoints: 0,
      level: 1,
      totalAuraEarned: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Simulate LLM evaluation of chat quality
 * This is a placeholder - in the future, this will call an actual LLM
 */
export function evaluateChatQuality(
  messages: Array<{ role: string; content: string }>
): number {
  // Placeholder implementation
  // In the future, this will use an LLM to evaluate:
  // - Conversation flow
  // - Engagement level
  // - Appropriateness
  // - Creativity
  // - Emotional intelligence

  const messageCount = messages.length;
  const avgMessageLength =
    messages.reduce((sum, msg) => sum + msg.content.length, 0) / messageCount;

  // Simple heuristic for now
  let quality = 0.5; // Base quality

  // Bonus for longer conversations
  if (messageCount >= 10) quality += 0.2;
  if (messageCount >= 20) quality += 0.1;

  // Bonus for meaningful messages
  if (avgMessageLength >= 50) quality += 0.1;
  if (avgMessageLength >= 100) quality += 0.1;

  // Bonus for asking questions (simple heuristic)
  const questionCount = messages.filter((msg) =>
    msg.content.includes("?")
  ).length;
  if (questionCount >= 3) quality += 0.1;

  return Math.min(quality, 1.0); // Cap at 1.0
}

/**
 * Process a completed chat session and award aura points
 */
export async function processChatSession(
  userId: string,
  characterId: string,
  characterName: string,
  messages: Array<{ role: string; content: string }>
): Promise<AuraUpdateResult> {
  const quality = evaluateChatQuality(messages);
  const chatData: ChatSessionData = {
    messageCount: messages.length,
    conversationLength: messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    ),
    quality,
    characterId,
    characterName,
  };

  return await awardAuraForChatSession(userId, chatData);
}

/**
 * Get aura leaderboard (top users by aura points)
 */
export async function getAuraLeaderboard(limit: number = 10) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, aura_points, level, avatar_url")
      .order("aura_points", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return {
      success: true,
      leaderboard: data || [],
    };
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return {
      success: false,
      leaderboard: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
