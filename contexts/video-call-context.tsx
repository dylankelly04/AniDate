"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { VideoCallNotification } from '@/components/ui/video-call-notification';

interface VideoCallContextType {
  incomingCall: {
    isVisible: boolean;
    fromUserId: string | null;
    matchId: string | null;
  };
  showIncomingCall: (fromUserId: string, matchId: string) => void;
  hideIncomingCall: () => void;
}

const VideoCallContext = createContext<VideoCallContextType | undefined>(undefined);

export function VideoCallProvider({ children }: { children: React.ReactNode }) {
  const [incomingCall, setIncomingCall] = useState({
    isVisible: false,
    fromUserId: null as string | null,
    matchId: null as string | null,
  });
  
  const { user } = useAuth();
  const supabase = createClient();

  const showIncomingCall = useCallback((fromUserId: string, matchId: string) => {
    setIncomingCall({
      isVisible: true,
      fromUserId,
      matchId,
    });
  }, []);

  const hideIncomingCall = useCallback(() => {
    setIncomingCall({
      isVisible: false,
      fromUserId: null,
      matchId: null,
    });
  }, []);

  // Listen for incoming video calls across the entire app
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`global_video_calls_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'video_call_signals',
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const signal = payload.new;
          const data = signal.signal_data;

          // Only handle offers (incoming calls)
          if (data.type === 'offer') {
            console.log('📞 Incoming video call from:', signal.from_user_id);
            showIncomingCall(signal.from_user_id, signal.match_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, showIncomingCall, supabase]);

  return (
    <VideoCallContext.Provider
      value={{
        incomingCall,
        showIncomingCall,
        hideIncomingCall,
      }}
    >
      {children}
      
      {/* Global video call notification */}
      {incomingCall.isVisible && incomingCall.fromUserId && incomingCall.matchId && (
        <VideoCallNotification
          isVisible={incomingCall.isVisible}
          onClose={hideIncomingCall}
          fromUserId={incomingCall.fromUserId}
          matchId={incomingCall.matchId}
        />
      )}
    </VideoCallContext.Provider>
  );
}

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (context === undefined) {
    throw new Error('useVideoCall must be used within a VideoCallProvider');
  }
  return context;
}
