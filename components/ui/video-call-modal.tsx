'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWebRTC, CallState } from '@/hooks/useWebRTC';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneCall,
  PhoneOff,
  Loader2 
} from 'lucide-react';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  userId: string;
  remoteUserId: string;
  remoteUserName: string;
  isIncoming?: boolean;
  incomingOffer?: RTCSessionDescriptionInit;
}

export function VideoCallModal({
  isOpen,
  onClose,
  matchId,
  userId,
  remoteUserId,
  remoteUserName,
  isIncoming = false,
  incomingOffer,
}: VideoCallModalProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const {
    callState,
    startCall,
    answerCall,
    endCall,
    localVideoRef,
    remoteVideoRef,
  } = useWebRTC({
    matchId,
    userId,
    onCallEnded: onClose,
  });

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (callState.isConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState.isConnected]);

  // Reset duration when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCallDuration(0);
    }
  }, [isOpen]);

  // Auto-start call if not incoming
  useEffect(() => {
    if (isOpen && !isIncoming && !callState.isConnecting && !callState.isConnected) {
      startCall(remoteUserId);
    }
  }, [isOpen, isIncoming, callState.isConnecting, callState.isConnected, startCall, remoteUserId]);

  const handleAnswerCall = () => {
    if (incomingOffer) {
      answerCall(incomingOffer, remoteUserId);
    }
  };

  const handleEndCall = () => {
    endCall();
    onClose();
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[80vh] p-0 overflow-hidden bg-black">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between text-white">
              <div>
                <h3 className="text-lg font-semibold">{remoteUserName}</h3>
                {callState.isConnected && (
                  <p className="text-sm text-white/80">{formatDuration(callDuration)}</p>
                )}
              </div>
              
              {callState.isConnecting && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    {isIncoming ? 'Incoming call...' : 'Connecting...'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Video Area */}
          <div className="flex-1 relative">
            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Local Video (Picture-in-Picture) */}
            <div className="absolute top-20 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
              />
              {!isVideoEnabled && (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <VideoOff className="w-6 h-6 text-white/60" />
                </div>
              )}
            </div>

            {/* No video placeholder */}
            {!callState.remoteStream && !callState.isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center text-white">
                  <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Video className="w-8 h-8" />
                  </div>
                  <p className="text-lg">{remoteUserName}</p>
                  <p className="text-sm text-white/60">
                    {isIncoming ? 'Incoming video call' : 'Starting video call...'}
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {callState.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/90">
                <div className="text-center text-white">
                  <PhoneOff className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-lg mb-2">Call Failed</p>
                  <p className="text-sm text-white/80">{callState.error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="flex items-center justify-center gap-4">
              {isIncoming && !callState.isConnecting && !callState.isConnected ? (
                // Incoming call controls
                <>
                  <Button
                    onClick={handleEndCall}
                    variant="destructive"
                    size="lg"
                    className="rounded-full w-14 h-14"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                  <Button
                    onClick={handleAnswerCall}
                    className="rounded-full w-14 h-14 bg-green-600 hover:bg-green-700"
                  >
                    <Phone className="w-6 h-6" />
                  </Button>
                </>
              ) : (
                // Active call controls
                <>
                  <Button
                    onClick={toggleAudio}
                    variant={isAudioEnabled ? "secondary" : "destructive"}
                    size="lg"
                    className="rounded-full w-12 h-12"
                  >
                    {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </Button>

                  <Button
                    onClick={toggleVideo}
                    variant={isVideoEnabled ? "secondary" : "destructive"}
                    size="lg"
                    className="rounded-full w-12 h-12"
                  >
                    {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </Button>

                  <Button
                    onClick={handleEndCall}
                    variant="destructive"
                    size="lg"
                    className="rounded-full w-14 h-14"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
