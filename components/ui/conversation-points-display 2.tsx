"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Star, 
  Lock, 
  Unlock, 
  Trophy, 
  MessageCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { 
  conversationPointsService, 
  ProfileUnlockLevel 
} from "@/lib/conversation-points-service";

interface ConversationPointsDisplayProps {
  matchId: string;
  userId: string;
  points?: number;
  onPointsUpdate?: (points: number) => void;
}

export function ConversationPointsDisplay({ 
  matchId, 
  userId, 
  points: initialPoints,
  onPointsUpdate 
}: ConversationPointsDisplayProps) {
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Use the points prop directly instead of internal state
  const conversationPoints = initialPoints || 0;
  
  // Debug logging
  console.log(`ConversationPointsDisplay - Received points: ${initialPoints}, Using: ${conversationPoints}`);

  useEffect(() => {
    // Only fetch points if not provided as prop
    if (initialPoints === undefined) {
      fetchConversationPoints();
    } else {
      setLoading(false);
    }
  }, [matchId, userId, initialPoints]);

  const fetchConversationPoints = async () => {
    try {
      const points = await conversationPointsService.getConversationPoints(matchId, userId);
      if (onPointsUpdate) {
        onPointsUpdate(points);
      }
    } catch (err) {
      console.error('Error fetching conversation points:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading points...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentLevel = conversationPointsService.getCurrentUnlockLevel(conversationPoints);
  const nextLevel = conversationPointsService.getNextUnlockLevel(conversationPoints);
  const pointsToNext = conversationPointsService.getPointsToNextUnlock(conversationPoints);
  const progressPercentage = nextLevel 
    ? ((conversationPoints - currentLevel.pointsRequired) / 
       (nextLevel.pointsRequired - currentLevel.pointsRequired)) * 100
    : 100;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <CardTitle className="text-lg">Connection Points</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Current Points and Level */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="font-semibold text-lg">{conversationPoints} pts</span>
          </div>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Level {currentLevel.level}
          </Badge>
        </div>

        {/* Progress to Next Level */}
        {nextLevel && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Progress to Level {nextLevel.level}</span>
              <span>{pointsToNext} points to go</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {nextLevel.description}
            </p>
          </div>
        )}

        {/* Current Unlocks */}
        {expanded && (
          <div className="space-y-3">
            {/* All Unlocked Features */}
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                <Unlock className="w-4 h-4 text-green-500" />
                All Unlocked Features
              </h4>
              <div className="flex flex-wrap gap-1">
                {conversationPointsService.getAllUnlockedFeatures(conversationPoints).map((unlock) => (
                  <Badge key={unlock} variant="outline" className="text-xs bg-green-50 border-green-200 text-green-800">
                    {unlock.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Next Unlocks */}
            {nextLevel && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <Lock className="w-4 h-4 text-gray-500" />
                  Next to Unlock (Level {nextLevel.level} - {nextLevel.pointsRequired} pts)
                </h4>
                <div className="flex flex-wrap gap-1">
                  {nextLevel.unlocks.map((unlock) => (
                    <Badge key={unlock} variant="secondary" className="text-xs opacity-60">
                      {unlock.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pointsToNext} more points needed
                </p>
              </div>
            )}


            {/* How to Earn Points */}
            <div className="pt-2 border-t">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                How to Earn Points
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Send a message: +5 points</li>
                <li>• Receive a reply: +5 points</li>
                <li>• Keep the conversation going!</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
