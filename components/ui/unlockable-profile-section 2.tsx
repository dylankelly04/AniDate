"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Star } from "lucide-react";
import { conversationPointsService } from "@/lib/conversation-points-service";

interface UnlockableProfileSectionProps {
  points: number;
  user: {
    id: string;
    full_name: string;
    age?: number;
    location?: string;
    bio?: string;
    interests?: string[];
    college?: string;
    avatar_url?: string | null;
  };
}

export function UnlockableProfileSection({ points, user }: UnlockableProfileSectionProps) {
  const currentLevel = conversationPointsService.getCurrentUnlockLevel(points);
  const nextLevel = conversationPointsService.getNextUnlockLevel(points);

  const isFieldUnlocked = (field: string) => conversationPointsService.isFieldUnlocked(points, field);
  const getPointsToNextUnlock = () => conversationPointsService.getPointsToNextUnlock(points);

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Profile Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info - Always unlocked */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-green-500" />
            <h3 className="font-medium">Basic Information</h3>
          </div>
          <div className="pl-6 space-y-1">
            <p><strong>Name:</strong> {user.full_name}</p>
            {user.age && <p><strong>Age:</strong> {user.age}</p>}
            {user.bio && (
              <p><strong>Bio:</strong> {user.bio}</p>
            )}
          </div>
        </div>

        {/* Interests */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isFieldUnlocked('interests') ? (
              <Unlock className="w-4 h-4 text-green-500" />
            ) : (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            <h3 className="font-medium">Interests</h3>
            {!isFieldUnlocked('interests') && (
              <Badge variant="outline" className="text-xs">
                Unlock at Level 2 (25 pts)
              </Badge>
            )}
          </div>
          {isFieldUnlocked('interests') ? (
            <div className="pl-6">
              {user.interests && user.interests.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {user.interests.map((interest, index) => (
                    <Badge key={index} variant="secondary">
                      {interest}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No interests listed</p>
              )}
            </div>
          ) : (
            <div className="pl-6">
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Keep chatting to unlock interests! ({getPointsToNextUnlock()} more points needed)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Location */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isFieldUnlocked('location') ? (
              <Unlock className="w-4 h-4 text-green-500" />
            ) : (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            <h3 className="font-medium">Location</h3>
            {!isFieldUnlocked('location') && (
              <Badge variant="outline" className="text-xs">
                Unlock at Level 3 (50 pts)
              </Badge>
            )}
          </div>
          {isFieldUnlocked('location') ? (
            <div className="pl-6">
              <p>{user.location || 'Location not specified'}</p>
            </div>
          ) : (
            <div className="pl-6">
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Keep chatting to unlock location! ({getPointsToNextUnlock()} more points needed)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* College */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isFieldUnlocked('college') ? (
              <Unlock className="w-4 h-4 text-green-500" />
            ) : (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            <h3 className="font-medium">Education</h3>
            {!isFieldUnlocked('college') && (
              <Badge variant="outline" className="text-xs">
                Unlock at Level 3 (50 pts)
              </Badge>
            )}
          </div>
          {isFieldUnlocked('college') ? (
            <div className="pl-6">
              <p>{user.college || 'Education not specified'}</p>
            </div>
          ) : (
            <div className="pl-6">
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Keep chatting to unlock education! ({getPointsToNextUnlock()} more points needed)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Social Media - Higher level unlock */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isFieldUnlocked('social_media') ? (
              <Unlock className="w-4 h-4 text-green-500" />
            ) : (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            <h3 className="font-medium">Social Media</h3>
            {!isFieldUnlocked('social_media') && (
              <Badge variant="outline" className="text-xs">
                Unlock at Level 4 (100 pts)
              </Badge>
            )}
          </div>
          {isFieldUnlocked('social_media') ? (
            <div className="pl-6">
              <p className="text-muted-foreground text-sm">Social media profiles will be shown here</p>
            </div>
          ) : (
            <div className="pl-6">
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Keep chatting to unlock social media! ({getPointsToNextUnlock()} more points needed)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Contact Information - Highest level unlock */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isFieldUnlocked('phone_number') ? (
              <Unlock className="w-4 h-4 text-green-500" />
            ) : (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            <h3 className="font-medium">Contact Information</h3>
            {!isFieldUnlocked('phone_number') && (
              <Badge variant="outline" className="text-xs">
                Unlock at Level 5 (200 pts)
              </Badge>
            )}
          </div>
          {isFieldUnlocked('phone_number') ? (
            <div className="pl-6">
              <p className="text-muted-foreground text-sm">Contact information will be shown here</p>
            </div>
          ) : (
            <div className="pl-6">
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Keep chatting to unlock contact info! ({getPointsToNextUnlock()} more points needed)
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
