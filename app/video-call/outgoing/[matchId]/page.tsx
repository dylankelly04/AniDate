'use client';

import { useState, useEffect } from 'react';
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

export default function OutgoingVideoCallPage() {
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

  const {
    callState,
    startCall,
    endCall,
    localVideoRef,
    remoteVideoRef,
  } = useWebRTC({
    matchId,
    userId: user?.id || '',
    onCallEnded: () => {
      router.push(`/user-chat/${matchId}`);
    },
  });

  // Fetch match details
  useEffect(() => {
    const fetchMatch = async () => {
      if (!user?.id) return;

      try {
        // Get the match details using the same logic as chat page
        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select(
            `
            *,
            matched_user:profiles!matches_user2_id_fkey(
              id,
              full_name,
              avatar_url,
              original_avatar_url,
              anime_avatar_url,
              age,
              bio,
              location,
              interests,
              college,
              instagram_handle,
              twitter_handle,
              tiktok_handle,
              discord_username,
              snapchat_username,
              relationship_status,
              occupation,
              height_ft,
              height_in,
              zodiac_sign
            )
          `
          )
          .eq("id", matchId)
          .eq("status", "accepted")
          .single();

        if (matchError || !matchData) {
          throw new Error("Match not found or not accepted");
        }

        // If user is user2, get user1's profile instead
        let matchedUser = matchData.matched_user;
        if (matchData.user2_id === user?.id) {
          const { data: user1Profile, error: profileError } = await supabase
            .from("profiles")
            .select(
              `
              id,
              full_name,
              avatar_url,
              original_avatar_url,
              anime_avatar_url,
              age,
              bio,
              location,
              interests,
              college,
              instagram_handle,
              twitter_handle,
              tiktok_handle,
              discord_username,
              snapchat_username,
              relationship_status,
              occupation,
              height_ft,
              height_in,
              zodiac_sign
            `
            )
            .eq("id", matchData.user1_id)
            .single();

          if (profileError || !user1Profile) {
            throw new Error("Could not fetch matched user profile");
          }
          matchedUser = user1Profile;
        }

        setMatch({ ...matchData, matched_user: matchedUser });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load match');
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [user?.id, matchId, supabase]);

  // Start call automatically when page loads
  useEffect(() => {
    if (match && user?.id && !callState.isConnecting && !callState.isConnected) {
      console.log('📞 Auto-starting outgoing call to:', match.matched_user.id);
      startCall(match.matched_user.id);
      
      // Set 30 second timeout
      const timeout = setTimeout(() => {
        console.log('📞 Call timed out after 30 seconds');
        handleEndCall();
      }, 30000);
      
      setCallTimeout(timeout);
    }
  }, [match, user?.id, callState.isConnecting, callState.isConnected, startCall]);

  // Clear timeout when call connects
  useEffect(() => {
    if (callState.isConnected && callTimeout) {
      clearTimeout(callTimeout);
      setCallTimeout(null);
    }
  }, [callState.isConnected, callTimeout]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (callState.isConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [callState.isConnected]);

  // Cleanup when component unmounts
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callState.localStream) {
        callState.localStream.getTracks().forEach(track => track.stop());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [callState.localStream]);

  // Ensure video elements are properly connected to streams
  useEffect(() => {
    if (localVideoRef.current && callState.localStream && localVideoRef.current.srcObject !== callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && callState.remoteStream && remoteVideoRef.current.srcObject !== callState.remoteStream) {
      remoteVideoRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

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
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (callState.localStream) {
      const audioTrack = callState.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading call...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4 text-red-400">Call Failed</h2>
            <p className="text-gray-300 mb-4">{error}</p>
            <Button 
              onClick={() => router.push(`/user-chat/${matchId}`)}
              variant="outline"
            >
              Back to Chat
            </Button>
          </CardContent>
        </Card>
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
              <span className="text-sm">Calling... waiting for answer</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative">
        {/* Remote Video (Full Screen) */}
        <video
          ref={remoteVideoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted={false}
        />
        
        {/* Local Video (Picture in Picture) */}
        <div className="absolute top-20 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/20">
          <video
            ref={localVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
        </div>

        {/* Connection Status Overlay */}
        {!callState.isConnected && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center mb-4 mx-auto">
                <img 
                  src={match.matched_user.avatar_url} 
                  alt={match.matched_user.full_name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              </div>
              <h2 className="text-2xl font-semibold mb-2">{match.matched_user.full_name}</h2>
              <p className="text-white/80">
                {callState.isConnecting ? 'Calling...' : 'Connecting...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex justify-center gap-4">
          <Button
            onClick={toggleAudio}
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </Button>
          
          <Button
            onClick={toggleVideo}
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>
          
          <Button
            onClick={handleEndCall}
            variant="destructive"
            size="lg"
            className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
