"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, GraduationCap, Lock, Unlock, Share2, Camera, Eye, EyeOff, X } from "lucide-react";
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
    original_avatar_url?: string | null;
    anime_avatar_url?: string | null;
    // Social Media Fields
    instagram_handle?: string | null;
    twitter_handle?: string | null;
    tiktok_handle?: string | null;
    discord_username?: string | null;
    snapchat_username?: string | null;
    // Additional Profile Fields
    relationship_status?: string | null;
    occupation?: string | null;
    height_ft?: number | null;
    height_in?: number | null;
    zodiac_sign?: string | null;
  };
  conversationPoints: number;
}

export function ProfileModal({ isOpen, onClose, user, conversationPoints }: ProfileModalProps) {
  const [showOriginalImage, setShowOriginalImage] = useState(false);
  const [showFullSizeImage, setShowFullSizeImage] = useState(false);
  
  const isFieldUnlocked = (field: string) => {
    const unlocked = conversationPointsService.isFieldUnlocked(conversationPoints, field);
    return unlocked;
  };

  // Get the current image URL based on toggle state
  const getCurrentImageUrl = () => {
    return showOriginalImage && user.original_avatar_url
      ? user.original_avatar_url
      : user.anime_avatar_url || user.avatar_url || "";
  };

  // Debug logging removed to reduce console spam

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
              <Avatar 
                className="w-full h-full cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => setShowFullSizeImage(true)}
              >
                <AvatarImage 
                  src={getCurrentImageUrl()} 
                  alt={user.full_name} 
                />
                <AvatarFallback className="text-2xl">
                  {user.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              
              {/* Photo Toggle Button - Only show if real photo is unlocked and both images exist */}
              {isFieldUnlocked('real_photo') && user.original_avatar_url && user.anime_avatar_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-6 px-2 text-xs"
                  onClick={() => setShowOriginalImage(!showOriginalImage)}
                >
                  {showOriginalImage ? (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      Anime
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
            {isFieldUnlocked('real_photo') && user.original_avatar_url && user.anime_avatar_url ? (
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                <Camera className="w-3 h-3" />
                <span>{showOriginalImage ? 'Showing real photo' : 'Showing anime version'}</span>
              </div>
            ) : !isFieldUnlocked('real_photo') ? (
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                <Lock className="w-3 h-3" />
                <span>Real photo unlocks at 200 points</span>
              </div>
            ) : null}
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

          {/* Interests - Level 2 (25 pts) */}
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

          {/* Location - Level 3 (50 pts) */}
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

          {/* Education - Level 3 (50 pts) */}
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

          {/* Social Media - Level 4 (100 pts) */}
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
                <div className="space-y-3">
                  {user.instagram_handle && (
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-pink-500" />
                      <span className="text-sm font-medium">Instagram:</span>
                      <span className="text-sm text-muted-foreground">@{user.instagram_handle}</span>
                    </div>
                  )}
                  {user.twitter_handle && (
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Twitter/X:</span>
                      <span className="text-sm text-muted-foreground">@{user.twitter_handle}</span>
                    </div>
                  )}
                  {user.tiktok_handle && (
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-black" />
                      <span className="text-sm font-medium">TikTok:</span>
                      <span className="text-sm text-muted-foreground">@{user.tiktok_handle}</span>
                    </div>
                  )}
                  {user.discord_username && (
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-medium">Discord:</span>
                      <span className="text-sm text-muted-foreground">{user.discord_username}</span>
                    </div>
                  )}
                  {user.snapchat_username && (
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium">Snapchat:</span>
                      <span className="text-sm text-muted-foreground">{user.snapchat_username}</span>
                    </div>
                  )}
                  {!user.instagram_handle && !user.twitter_handle && !user.tiktok_handle && 
                   !user.discord_username && !user.snapchat_username && (
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">No social media profiles added</span>
                    </div>
                  )}
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

      {/* Full Size Image Modal */}
      <Dialog open={showFullSizeImage} onOpenChange={setShowFullSizeImage}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
          <div className="relative">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setShowFullSizeImage(false)}
            >
              <X className="w-4 h-4" />
            </Button>

            {/* Photo Toggle Button for Full Size */}
            {isFieldUnlocked('real_photo') && user.original_avatar_url && user.anime_avatar_url && (
              <Button
                variant="outline"
                size="sm"
                className="absolute top-4 left-4 z-10 bg-black/50 hover:bg-black/70 text-white border-white/20"
                onClick={() => setShowOriginalImage(!showOriginalImage)}
              >
                {showOriginalImage ? (
                  <>
                    <EyeOff className="w-3 h-3 mr-1" />
                    Anime
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Real
                  </>
                )}
              </Button>
            )}

            {/* Full Size Image */}
            <div className="flex items-center justify-center bg-black min-h-[60vh] max-h-[80vh]">
              <img
                src={getCurrentImageUrl()}
                alt={user.full_name}
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: '80vh' }}
              />
            </div>

            {/* Image Info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="text-white text-center">
                <h3 className="text-lg font-semibold">{user.full_name}</h3>
                {isFieldUnlocked('real_photo') && user.original_avatar_url && user.anime_avatar_url && (
                  <p className="text-sm text-white/80 mt-1">
                    {showOriginalImage ? 'Real Photo' : 'Anime Version'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
