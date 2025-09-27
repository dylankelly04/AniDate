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
  },
  {
    level: 6,
    pointsRequired: 1000,
    unlocks: ["video_chat"],
    description: "Video chat feature"
  }
];

// Video chat unlock threshold
export const VIDEO_CHAT_UNLOCK_POINTS = 1000;

export class ConversationPointsService {
  private supabase = createClient();

  /**
   * Get conversation points for a match
   * Points are automatically calculated based on message count
   */
  async getConversationPoints(matchId: string, userId: string): Promise<number> {
    try {
      // Calculate points based on message types: 1 point for sent, 2 points for received
      const { data: messages, error } = await this.supabase
        .from('user_messages')
        .select('sender_id')
        .eq('match_id', matchId);

      if (error) {
        console.error('Error fetching messages for points calculation:', error);
        return 0;
      }

      if (!messages || messages.length === 0) {
        return 0;
      }

      let totalPoints = 0;
      messages.forEach(message => {
        if (message.sender_id === userId) {
          totalPoints += 1; // 1 point for sending a message
        } else {
          totalPoints += 2; // 2 points for receiving a message
        }
      });

      console.log(`Calculated points for user ${userId}: ${totalPoints} total points (${messages.length} total messages)`);
      return totalPoints;
    } catch (error) {
      console.error('Error getting conversation points:', error);
      return 0;
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

  canInitiateVideoCall(points: number): boolean {
    return points >= VIDEO_CHAT_UNLOCK_POINTS;
  }
}

// Export singleton instance
export const conversationPointsService = new ConversationPointsService();
