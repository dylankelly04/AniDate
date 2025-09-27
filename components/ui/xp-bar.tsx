"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Star, Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface XPBarProps {
  currentXP: number;
  level: number;
  className?: string;
  showLevel?: boolean;
  showXP?: boolean;
  size?: "sm" | "md" | "lg";
}

// Calculate XP needed for current level
function getXPForCurrentLevel(level: number): number {
  return (level - 1) * 100;
}

// Calculate XP needed for next level
function getXPForNextLevel(level: number): number {
  return level * 100;
}

// Get level icon based on level
function getLevelIcon(level: number) {
  if (level >= 20) return <Crown className="w-4 h-4" />;
  if (level >= 10) return <Star className="w-4 h-4" />;
  if (level >= 5) return <Zap className="w-4 h-4" />;
  return <Sparkles className="w-4 h-4" />;
}

// Get level color based on level
function getLevelColor(level: number): string {
  if (level >= 20) return "text-purple-600 bg-purple-100 border-purple-200";
  if (level >= 10) return "text-yellow-600 bg-yellow-100 border-yellow-200";
  if (level >= 5) return "text-blue-600 bg-blue-100 border-blue-200";
  return "text-green-600 bg-green-100 border-green-200";
}

// Get progress bar color based on level
function getProgressColor(level: number): string {
  if (level >= 20) return "bg-gradient-to-r from-purple-500 to-purple-600";
  if (level >= 10) return "bg-gradient-to-r from-yellow-500 to-yellow-600";
  if (level >= 5) return "bg-gradient-to-r from-blue-500 to-blue-600";
  return "bg-gradient-to-r from-green-500 to-green-600";
}

export function XPBar({
  currentXP,
  level,
  className,
  showLevel = true,
  showXP = true,
  size = "md",
}: XPBarProps) {
  const currentLevelXP = getXPForCurrentLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const progressXP = currentXP - currentLevelXP;
  const neededXP = nextLevelXP - currentLevelXP;
  const progressPercentage = Math.min((progressXP / neededXP) * 100, 100);

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Level and XP Info */}
      <div className="flex items-center justify-between">
        {showLevel && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1 font-semibold",
                getLevelColor(level),
                sizeClasses[size]
              )}
            >
              {getLevelIcon(level)}
              Level {level}
            </Badge>
          </div>
        )}

        {showXP && (
          <div className={cn("text-muted-foreground", sizeClasses[size])}>
            {progressXP.toLocaleString()} / {neededXP.toLocaleString()} XP
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <Progress value={progressPercentage} className="h-2 bg-muted" />
        <div className={cn("text-xs text-muted-foreground", sizeClasses[size])}>
          {currentXP.toLocaleString()} total aura points
        </div>
      </div>

      {/* Level Up Indicator */}
      {progressPercentage >= 100 && (
        <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
          <Sparkles className="w-3 h-3" />
          Ready to level up!
        </div>
      )}
    </div>
  );
}

// Compact version for smaller spaces
export function CompactXPBar({
  currentXP,
  level,
  className,
}: Omit<XPBarProps, "showLevel" | "showXP" | "size">) {
  const currentLevelXP = getXPForCurrentLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const progressXP = currentXP - currentLevelXP;
  const neededXP = nextLevelXP - currentLevelXP;
  const progressPercentage = Math.min((progressXP / neededXP) * 100, 100);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-1 text-xs font-semibold",
          getLevelColor(level)
        )}
      >
        {getLevelIcon(level)}L{level}
      </Badge>

      <div className="flex-1 min-w-0">
        <Progress value={progressPercentage} className="h-1.5 bg-muted" />
      </div>

      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {progressXP}/{neededXP}
      </span>
    </div>
  );
}

// Level display component
export function LevelDisplay({
  level,
  className,
  size = "md",
}: {
  level: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1 font-semibold",
        getLevelColor(level),
        sizeClasses[size],
        className
      )}
    >
      {getLevelIcon(level)}
      Level {level}
    </Badge>
  );
}
