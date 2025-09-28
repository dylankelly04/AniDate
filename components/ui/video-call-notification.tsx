"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface VideoCallNotificationProps {
  isVisible: boolean;
  onClose: () => void;
  fromUserId: string;
  matchId: string;
}

export function VideoCallNotification({ isVisible, onClose, fromUserId, matchId }: VideoCallNotificationProps) {
  const [callerProfile, setCallerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (isVisible && fromUserId) {
      fetchCallerProfile();
    }
  }, [isVisible, fromUserId]);

  const fetchCallerProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, age')
        .eq('id', fromUserId)
        .single();

      if (error) {
        console.error('Error fetching caller profile:', error);
        return;
      }

      setCallerProfile(profile);
    } catch (error) {
      console.error('Error fetching caller profile:', error);
    }
  };

  const handleAcceptCall = async () => {
    setLoading(true);
    
    try {
      // Send call accepted signal to let the caller know
      await supabase
        .from('video_call_signals')
        .insert({
          match_id: matchId,
          from_user_id: user?.id,
          to_user_id: fromUserId,
          signal_type: 'call-accepted',
          signal_data: { type: 'call-accepted' },
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error sending call accepted signal:', error);
    }
    
    // Close the popup first, then navigate
    onClose();
    
    // Navigate to video call page - it will automatically answer the incoming call
    router.push(`/video-call/${matchId}`);
  };

  const handleDeclineCall = async () => {
    try {
      // Send decline signal
      await supabase
        .from('video_call_signals')
        .insert({
          match_id: matchId,
          from_user_id: user?.id,
          to_user_id: fromUserId,
          signal_type: 'end-call',
          signal_data: { type: 'end-call', reason: 'declined' },
          created_at: new Date().toISOString(),
        });
      console.log('📞 Call declined');
    } catch (error) {
      console.error('Error declining call:', error);
    } finally {
      onClose();
    }
  };

  if (!isVisible || !callerProfile) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 text-center space-y-4">
          <div className="relative mx-auto w-20 h-20">
            <Avatar className="w-full h-full">
              <AvatarImage
                src={callerProfile.avatar_url || ""}
                alt={callerProfile.full_name}
              />
              <AvatarFallback className="text-lg">
                {callerProfile.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
          </div>

          <div>
            <h3 className="text-lg font-semibold">{callerProfile.full_name}</h3>
            <p className="text-sm text-muted-foreground">
              Incoming video call...
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleDeclineCall}
              variant="destructive"
              size="icon"
              className="w-12 h-12 rounded-full"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
            <Button
              onClick={handleAcceptCall}
              disabled={loading}
              className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-700"
            >
              <Phone className="w-5 h-5" />
            </Button>
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground">
              Connecting...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
