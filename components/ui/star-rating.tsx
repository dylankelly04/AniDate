"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  level: number; // 0-5
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
}

export function StarRating({
  level,
  size = "sm",
  showNumber = false,
  className,
}: StarRatingProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const gapClasses = {
    sm: "gap-0.5",
    md: "gap-1",
    lg: "gap-1",
  };

  return (
    <div className={cn("flex items-center", gapClasses[size], className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClasses[size],
            star <= level ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          )}
        />
      ))}
      {showNumber && (
        <span className="text-xs text-muted-foreground ml-1">{level}/5</span>
      )}
    </div>
  );
}

// Connection level descriptions
export const CONNECTION_LEVELS = {
  0: { name: "Stranger", description: "Just met" },
  1: { name: "Acquaintance", description: "Getting to know each other" },
  2: { name: "Friend", description: "Building a friendship" },
  3: { name: "Close Friend", description: "Deep conversations" },
  4: { name: "Best Friend", description: "Very close bond" },
  5: { name: "Soulmate", description: "Perfect connection" },
} as const;

export function ConnectionLevelBadge({ level }: { level: number }) {
  const levelInfo = CONNECTION_LEVELS[level as keyof typeof CONNECTION_LEVELS];

  return (
    <div className="flex items-center gap-2">
      <StarRating level={level} size="sm" />
      <div className="text-xs">
        <div className="font-medium">{levelInfo.name}</div>
        <div className="text-muted-foreground">{levelInfo.description}</div>
      </div>
    </div>
  );
}
