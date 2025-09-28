import { createClient } from "@/lib/supabase/client";

export interface ProfileUnlockLevel {
  level: number;
  pointsRequired: number;
  unlocks: string[];
  description: string;
}

export const PROFILE_UNLOCK_LEVELS: ProfileUnlockLevel[] = [
  {
    level: 1,
    pointsRequired: 0,
    unlocks: ["basic_info", "bio", "avatar"],
    description: "Basic profile information"
  },
  {
    level: 2,
    pointsRequired: 25,
    unlocks: ["interests"],
    description: "Interests and hobbies"
  },
  {
    level: 3,
    pointsRequired: 50,
    unlocks: ["college", "location"],
    description: "Education and location details"
  },
  {
    level: 4,
    pointsRequired: 100,
    unlocks: ["social_media"],
    description: "Social media profiles"
  },
  {
    level: 5,
    pointsRequired: 200,
    unlocks: ["real_photo"],
    description: "Real (non-AI) photo"
  }
];

export class ConversationPointsService {
  private supabase = createClient();

  /**
   * Get conversation points for a match
   * Points are automatically calculated based on message count
   */
  async getConversationPoints(matchId: string, userId: string): Promise<number> {
    try {
      // First try the RPC function
      const { data: rpcData, error: rpcError } = await this.supabase.rpc('get_conversation_points', {
        p_match_id: matchId,
        p_user_id: userId
      });

      if (!rpcError && rpcData !== null) {
        return rpcData;
      }

      // Fallback: calculate directly from message count
      console.log('RPC failed, using fallback calculation:', rpcError);
      const messageCount = await this.getMessageCount(matchId);
      return messageCount * 5;
    } catch (err) {
      console.error('Exception in getConversationPoints:', err);
      // Final fallback: calculate from message count
      const messageCount = await this.getMessageCount(matchId);
      return messageCount * 5;
    }
  }

  /**
   * Get message count for a match (used for points calculation)
   */
  async getMessageCount(matchId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('user_messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchId);

      if (error) {
        console.error('Error fetching message count:', error);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.error('Exception in getMessageCount:', err);
      return 0;
    }
  }

  /**
   * Get current unlock level based on points
   */
  getCurrentUnlockLevel(points: number): ProfileUnlockLevel {
    for (let i = PROFILE_UNLOCK_LEVELS.length - 1; i >= 0; i--) {
      if (points >= PROFILE_UNLOCK_LEVELS[i].pointsRequired) {
        return PROFILE_UNLOCK_LEVELS[i];
      }
    }
    return PROFILE_UNLOCK_LEVELS[0];
  }

  /**
   * Get next unlock level
   */
  getNextUnlockLevel(points: number): ProfileUnlockLevel | null {
    for (const level of PROFILE_UNLOCK_LEVELS) {
      if (points < level.pointsRequired) {
        return level;
      }
    }
    return null;
  }

  /**
   * Check if a specific profile field is unlocked
   */
  isFieldUnlocked(points: number, field: string): boolean {
    // Check all levels up to and including the current level
    for (const level of PROFILE_UNLOCK_LEVELS) {
      if (points >= level.pointsRequired && level.unlocks.includes(field)) {
        console.log(`Field "${field}" unlocked at level ${level.level} (${level.pointsRequired} pts) with ${points} points`);
        return true;
      }
    }
    console.log(`Field "${field}" locked - need more points (current: ${points})`);
    return false;
  }

  /**
   * Get points needed for next unlock
   */
  getPointsToNextUnlock(points: number): number {
    const nextLevel = this.getNextUnlockLevel(points);
    if (!nextLevel) return 0;
    return nextLevel.pointsRequired - points;
  }

  /**
   * Get all unlocked features for the current points
   */
  getAllUnlockedFeatures(points: number): string[] {
    const unlockedFeatures: string[] = [];
    for (const level of PROFILE_UNLOCK_LEVELS) {
      if (points >= level.pointsRequired) {
        unlockedFeatures.push(...level.unlocks);
      }
    }
    return unlockedFeatures;
  }

  /**
   * Get all future unlock levels that haven't been reached yet
   */
  getFutureUnlocks(points: number): ProfileUnlockLevel[] {
    return PROFILE_UNLOCK_LEVELS.filter(level => points < level.pointsRequired);
  }
}

// Export singleton instance
export const conversationPointsService = new ConversationPointsService();
