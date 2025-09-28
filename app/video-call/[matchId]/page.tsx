'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, ArrowLeft } from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function VideoCallPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  const { user } = useAuth();
  const supabase = createClient();

  const [match, setMatch] = useState<any>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callTimeout, setCallTimeout] = useState<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only initialize WebRTC when we have a valid user
  const webRTCEnabled = !!user?.id;
  
  const {
    callState,
    startCall,
    answerCall,
    endCall,
    localVideoRef,
    remoteVideoRef,
  } = useWebRTC({
    matchId,
    userId: user?.id || '',
    autoAnswerIncoming: true, // Auto-answer when user navigates to video call page
    onCallEnded: () => {
      router.push(`/user-chat/${matchId}`);
    },
  });

  // Fetch match details
  useEffect(() => {
    const fetchMatch = async () => {
      if (!matchId || !user?.id) return;

      try {
        // First, get the match details
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .eq('status', 'accepted')
          .single();

        if (matchError || !matchData) {
          setError('Match not found or not accepted');
          return;
        }

        // Check if user is part of this match
        if (matchData.user1_id !== user.id && matchData.user2_id !== user.id) {
          setError('You are not part of this match');
          return;
        }

        // Get the matched user's profile
        const matchedUserId = matchData.user1_id === user.id ? matchData.user2_id : matchData.user1_id;
        const { data: matchedUserProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', matchedUserId)
          .single();

        if (profileError || !matchedUserProfile) {
          setError('Could not load matched user profile');
          return;
        }

        // Set the match with the matched user profile
        setMatch({
          ...matchData,
          matched_user: matchedUserProfile
        });
      } catch (err) {
        setError('Failed to load match');
        console.error('Error fetching match:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [matchId, user?.id, supabase]);

  // Cleanup when component unmounts or user navigates away
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clean up streams directly
      if (callState.localStream) {
        callState.localStream.getTracks().forEach(track => track.stop());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Clean up when component unmounts (navigation away)
      if (callState.localStream) {
        console.log('🛑 Stopping camera tracks on unmount');
        callState.localStream.getTracks().forEach(track => {
          console.log(`🛑 Stopping ${track.kind} track`);
          track.stop();
        });
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [callState.localStream]); // Include localStream to ensure cleanup when stream exists

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.isConnected) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else if (!callState.isConnected && callDuration > 0) {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState.isConnected, callDuration]);

  // Auto-start call when page loads or answer incoming call
  useEffect(() => {
    if (match && user?.id && !callState.isConnecting && !callState.isConnected) {
      if (!callState.isIncoming) {
        startCall(match.matched_user.id);
        
        const timeout = setTimeout(() => {
          handleEndCall();
        }, 30000);
        
        setCallTimeout(timeout);
      }
    }
  }, [match, user?.id, callState.isConnecting, callState.isConnected, callState.isIncoming, startCall]);

  // Clear timeout when call connects or ends
  useEffect(() => {
    if (callState.isConnected || !match) {
      if (callTimeout) {
        clearTimeout(callTimeout);
        setCallTimeout(null);
      }
    }
  }, [callState.isConnected, match, callTimeout]);

  const handleEndCall = () => {
    endCall();
    if (callTimeout) {
      clearTimeout(callTimeout);
      setCallTimeout(null);
    }
    router.push(`/user-chat/${matchId}`);
  };

  const toggleVideo = () => {
    if (callState.localStream) {
      const videoTrack = callState.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (callState.localStream) {
      const audioTrack = callState.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  if (loading || !user?.id) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading video call...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-xl mb-4">Error: {error || 'Match not found'}</p>
          <Button onClick={() => router.push('/matches')} variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Matches
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => {
                if (callState.localStream) {
                  callState.localStream.getTracks().forEach(track => {
                    track.stop();
                  });
                }
                router.push(`/user-chat/${matchId}`);
              }}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{match.matched_user.full_name}</h1>
              {callState.isConnected && (
                <p className="text-sm text-white/80">{formatDuration(callDuration)}</p>
              )}
            </div>
          </div>
          
          {callState.isConnecting && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">
                {callState.isIncoming ? 'Joining call...' : 'Calling... waiting for answer'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-gray-900">
        {/* Remote Video (Full Screen) */}
        {callState.remoteStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {/* Local Video (Full screen when no remote, PiP when remote exists) */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute ${callState.remoteStream ? 'top-20 right-4 w-32 h-24 bg-gray-800 rounded-lg border-2 border-white/20' : 'inset-0'} object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
          style={{ backgroundColor: '#1f2937' }}
        />
        
        {/* Video disabled overlay for PiP */}
        {callState.remoteStream && !isVideoEnabled && (
          <div className="absolute top-20 right-4 w-32 h-24 bg-gray-800 rounded-lg flex items-center justify-center border-2 border-white/20">
            <VideoOff className="w-6 h-6 text-white/60" />
          </div>
        )}
        
        {/* Status Overlays */}
        {!callState.localStream && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-20 h-20 bg-gray-700/80 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8" />
              </div>
              <p className="text-lg">Starting camera...</p>
              <p className="text-sm text-white/80">
                Please allow camera access
              </p>
            </div>
          </div>
        )}

        {/* Call status overlay */}
        {callState.localStream && !callState.remoteStream && (
          <div className="absolute top-20 left-4 right-4">
            <div className="bg-black/50 rounded-lg p-3 text-center">
              <p className="text-white text-sm font-medium">{match.matched_user.full_name}</p>
              <p className="text-white/80 text-xs">
                Calling... waiting for them to join the chat
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {callState.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/90">
            <div className="text-center text-white">
              <p className="text-lg font-semibold">Call Error</p>
              <p className="text-sm mb-4">{callState.error}</p>
              <Button onClick={handleEndCall}>
                End Call
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/70 to-transparent flex justify-center gap-4">
        <Button onClick={toggleAudio} variant="secondary" size="icon">
          {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>
        <Button onClick={toggleVideo} variant="secondary" size="icon">
          {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
        <Button onClick={handleEndCall} variant="destructive" size="icon">
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
