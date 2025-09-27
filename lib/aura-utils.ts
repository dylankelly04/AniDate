// Aura Points Utility Functions
// These functions mirror the database functions for client-side calculations

/**
 * Calculate level from aura points
 * Formula: Each level requires 100 points (0-99 = Level 1, 100-199 = Level 2, etc.)
 */
export function calculateLevel(auraPoints: number): number {
  if (auraPoints < 0) return 1;
  return Math.floor(auraPoints / 100) + 1;
}

/**
 * Calculate aura points needed for current level
 * Formula: (level - 1) * 100
 */
export function getAuraPointsForCurrentLevel(level: number): number {
  return (level - 1) * 100;
}

/**
 * Calculate aura points needed for next level
 * Formula: level * 100
 */
export function getAuraPointsForNextLevel(level: number): number {
  return level * 100;
}

/**
 * Calculate progress towards next level
 */
export function getLevelProgress(currentAura: number, level: number) {
  const currentLevelXP = getAuraPointsForCurrentLevel(level);
  const nextLevelXP = getAuraPointsForNextLevel(level);
  const progressXP = currentAura - currentLevelXP;
  const neededXP = nextLevelXP - currentLevelXP;
  const progressPercentage = Math.min((progressXP / neededXP) * 100, 100);

  return {
    currentLevelXP,
    nextLevelXP,
    progressXP,
    neededXP,
    progressPercentage,
  };
}

/**
 * Get level title based on level
 */
export function getLevelTitle(level: number): string {
  if (level >= 50) return "Aura Master";
  if (level >= 40) return "Aura Sage";
  if (level >= 30) return "Aura Expert";
  if (level >= 20) return "Aura Champion";
  if (level >= 15) return "Aura Warrior";
  if (level >= 10) return "Aura Adept";
  if (level >= 5) return "Aura Apprentice";
  return "Aura Novice";
}

/**
 * Get level description
 */
export function getLevelDescription(level: number): string {
  if (level >= 50) return "You have mastered the art of aura manipulation";
  if (level >= 40) return "Your aura wisdom is legendary";
  if (level >= 30) return "You are an expert in aura techniques";
  if (level >= 20) return "You are a champion of aura mastery";
  if (level >= 15) return "You are a skilled aura warrior";
  if (level >= 10) return "You have become an aura adept";
  if (level >= 5) return "You are learning the ways of aura";
  return "You are just beginning your aura journey";
}

/**
 * Calculate aura points to award based on chat performance
 * Simple system: 1 point per message sent
 */
export function calculateAuraReward(chatData: {
  messageCount: number;
  conversationLength: number;
  quality?: number; // 0-1, will be determined by LLM
}): number {
  const { messageCount } = chatData;

  // Simple system: 1 point per message sent
  return messageCount;
}

/**
 * Get aura points milestones
 */
export function getAuraMilestones(): Array<{
  level: number;
  auraPoints: number;
  title: string;
  description: string;
}> {
  return [
    {
      level: 1,
      auraPoints: 0,
      title: "Aura Novice",
      description: "Begin your journey",
    },
    {
      level: 5,
      auraPoints: 400,
      title: "Aura Apprentice",
      description: "Learning the basics",
    },
    {
      level: 10,
      auraPoints: 900,
      title: "Aura Adept",
      description: "Developing skills",
    },
    {
      level: 15,
      auraPoints: 1400,
      title: "Aura Warrior",
      description: "Becoming skilled",
    },
    {
      level: 20,
      auraPoints: 1900,
      title: "Aura Champion",
      description: "Mastering techniques",
    },
    {
      level: 30,
      auraPoints: 2900,
      title: "Aura Expert",
      description: "Expert level mastery",
    },
    {
      level: 40,
      auraPoints: 3900,
      title: "Aura Sage",
      description: "Wise in the ways of aura",
    },
    {
      level: 50,
      auraPoints: 4900,
      title: "Aura Master",
      description: "Ultimate aura mastery",
    },
  ];
}
