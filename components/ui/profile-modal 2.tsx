"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, GraduationCap, Lock, Unlock, Share2, Camera, Eye, EyeOff } from "lucide-react";
import { conversationPointsService } from "@/lib/conversation-points-service";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  conversationPoints: number;
}

export function ProfileModal({ isOpen, onClose, user, conversationPoints }: ProfileModalProps) {
  const [showRealPhoto, setShowRealPhoto] = useState(false);
  
  const isFieldUnlocked = (field: string) => {
    const unlocked = conversationPointsService.isFieldUnlocked(conversationPoints, field);
    console.log(`Field "${field}" with ${conversationPoints} points: ${unlocked ? 'UNLOCKED' : 'LOCKED'}`);
    return unlocked;
  };

  // Generate real photo URL from avatar_url (assuming bucket structure)
  const getRealPhotoUrl = (avatarUrl: string | null) => {
    if (!avatarUrl) return null;
    // Assuming real photos are stored with a different prefix or suffix
    // This is a placeholder - you'll need to adjust based on your bucket structure
    return avatarUrl.replace('/ai/', '/real/') || avatarUrl.replace('_ai.', '_real.');
  };

  const realPhotoUrl = getRealPhotoUrl(user.avatar_url);

  console.log(`ProfileModal - Points: ${conversationPoints}, User:`, user);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Profile Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Profile Header */}
          <div className="text-center">
            <div className="relative mx-auto w-24 h-24 mb-4">
              <Avatar className="w-full h-full">
                <AvatarImage 
                  src={showRealPhoto && realPhotoUrl ? realPhotoUrl : user.avatar_url || ""} 
                  alt={user.full_name} 
                />
                <AvatarFallback className="text-2xl">
                  {user.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              
              {/* Photo Toggle Button - Only show if real photo is unlocked */}
              {isFieldUnlocked('real_photo') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-6 px-2 text-xs"
                  onClick={() => setShowRealPhoto(!showRealPhoto)}
                >
                  {showRealPhoto ? (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      AI
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      Real
                    </>
                  )}
                </Button>
              )}
            </div>
            <h2 className="text-2xl font-bold">{user.full_name}</h2>
            {user.age && (
              <div className="flex items-center justify-center gap-1 text-muted-foreground mt-1">
                <Calendar className="w-4 h-4" />
                <span>{user.age} years old</span>
              </div>
            )}
            
            {/* Photo Status Indicator */}
            {isFieldUnlocked('real_photo') ? (
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                <Camera className="w-3 h-3" />
                <span>{showRealPhoto ? 'Showing real photo' : 'Showing AI photo'}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                <Lock className="w-3 h-3" />
                <span>Real photo unlocks at 200 points</span>
              </div>
            )}
          </div>

          {/* Bio */}
          {user.bio && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{user.bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {isFieldUnlocked('location') ? (
                  <Unlock className="w-4 h-4 text-green-500" />
                ) : (
                  <Lock className="w-4 h-4 text-gray-400" />
                )}
                Location
                {!isFieldUnlocked('location') && (
                  <Badge variant="outline" className="text-xs">
                    Unlock at Level 3 (50 pts)
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isFieldUnlocked('location') ? (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{user.location || 'Location not specified'}</span>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                  <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keep chatting to unlock location!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {isFieldUnlocked('college') ? (
                  <Unlock className="w-4 h-4 text-green-500" />
                ) : (
                  <Lock className="w-4 h-4 text-gray-400" />
                )}
                Education
                {!isFieldUnlocked('college') && (
                  <Badge variant="outline" className="text-xs">
                    Unlock at Level 3 (50 pts)
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isFieldUnlocked('college') ? (
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  <span>{user.college || 'Education not specified'}</span>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                  <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keep chatting to unlock education!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interests */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {isFieldUnlocked('interests') ? (
                  <Unlock className="w-4 h-4 text-green-500" />
                ) : (
                  <Lock className="w-4 h-4 text-gray-400" />
                )}
                Interests
                {!isFieldUnlocked('interests') && (
                  <Badge variant="outline" className="text-xs">
                    Unlock at Level 2 (25 pts)
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isFieldUnlocked('interests') ? (
                user.interests && user.interests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.interests.map((interest, index) => (
                      <Badge key={index} variant="secondary">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No interests listed</p>
                )
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                  <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keep chatting to unlock interests!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {isFieldUnlocked('social_media') ? (
                  <Unlock className="w-4 h-4 text-green-500" />
                ) : (
                  <Lock className="w-4 h-4 text-gray-400" />
                )}
                Social Media
                {!isFieldUnlocked('social_media') && (
                  <Badge variant="outline" className="text-xs">
                    Unlock at Level 4 (100 pts)
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isFieldUnlocked('social_media') ? (
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Social media profiles will be shown here</span>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-center">
                  <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keep chatting to unlock social media profiles!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>


          {/* Close Button */}
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
