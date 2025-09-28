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

    console.log('🔌 Setting up video call subscription for user:', user.id);

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
          console.log('📨 Received real-time signal:', payload);
          const signal = payload.new;
          const data = signal.signal_data;

          // Only handle offers (incoming calls) and only if not already in a call
          if (data.type === 'offer' && !incomingCall.isVisible) {
            // Don't show popup if user is already on video call page
            if (window.location.pathname.includes('/video-call/')) {
              console.log('📞 User already on video call page, skipping popup');
              return;
            }
            console.log('📞 Showing incoming call popup');
            showIncomingCall(signal.from_user_id, signal.match_id);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to video call updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Video call subscription error');
        }
      });

    return () => {
      console.log('🔌 Cleaning up video call subscription');
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
