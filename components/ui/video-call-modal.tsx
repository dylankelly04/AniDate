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
  // Debug logging removed
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callTimeout, setCallTimeout] = useState<NodeJS.Timeout | null>(null);

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

  // Debug: Log when local stream changes
  useEffect(() => {
    console.log('🎥 Local stream changed:', callState.localStream);
    if (callState.localStream) {
      console.log('📹 Video tracks:', callState.localStream.getVideoTracks().length);
      console.log('🎤 Audio tracks:', callState.localStream.getAudioTracks().length);
      
      // Ensure video element gets the stream with retry mechanism
      const assignStream = () => {
        if (localVideoRef.current && callState.localStream) {
          console.log('📺 Assigning stream to video element');
          localVideoRef.current.srcObject = callState.localStream;
          
          // Force play
          localVideoRef.current.play()
            .then(() => console.log('✅ Video playing after stream assignment'))
            .catch(e => console.error('❌ Video play failed after assignment:', e));
          
          return true;
        } else {
          console.warn('⚠️ Video ref or stream not available for assignment');
          return false;
        }
      };

      // Try immediately and retry if needed
      if (!assignStream()) {
        setTimeout(assignStream, 200);
      }
    }
  }, [callState.localStream]);

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
      console.log('🎬 Modal opened, checking video ref:', localVideoRef.current);
      
      // Start call immediately when modal opens
      startCall(remoteUserId);
      
      // Set timeout for unanswered calls (30 seconds)
      const timeout = setTimeout(() => {
        handleEndCall();
      }, 30000);
      
      setCallTimeout(timeout);
    }
  }, [isOpen, isIncoming, callState.isConnecting, callState.isConnected, startCall, remoteUserId]);

  // Clear timeout when call connects or ends
  useEffect(() => {
    if (callState.isConnected || !isOpen) {
      if (callTimeout) {
        clearTimeout(callTimeout);
        setCallTimeout(null);
      }
    }
  }, [callState.isConnected, isOpen, callTimeout]);

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
        {/* Debug indicator */}
        <div className="absolute top-2 right-2 z-50 bg-red-500 text-white px-2 py-1 text-xs rounded">
          MODAL OPEN: {isOpen ? 'YES' : 'NO'}
        </div>
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
                    {isIncoming ? 'Incoming call...' : 'Calling... waiting for answer'}
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

            {/* Local Video (Always rendered to ensure ref is available) */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`absolute ${callState.remoteStream ? 'top-20 right-4 w-32 h-24 bg-gray-800 rounded-lg border-2 border-white/20' : 'inset-0'} object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
              style={{ backgroundColor: '#1f2937' }}
              onLoadedData={() => console.log('📺 Local video loaded and ready')}
              onError={(e) => console.error('📺 Video error:', e)}
              onPlay={() => console.log('📺 Local video started playing')}
              onPause={() => console.log('📺 Local video paused')}
              onCanPlay={() => console.log('📺 Local video can play')}
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

            {/* Always visible debug button */}
            <div className="absolute top-4 left-4">
              <Button 
                onClick={async () => {
                  console.log('🔧 Manual camera test button clicked');
                  console.log('🔍 Current localStream:', callState.localStream);
                  console.log('🔍 Current video ref:', localVideoRef.current);
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    console.log('✅ Manual stream obtained:', stream);
                    if (localVideoRef.current) {
                      localVideoRef.current.srcObject = stream;
                      console.log('✅ Manual stream assigned to video element');
                      // Force play
                      localVideoRef.current.play()
                        .then(() => console.log('✅ Manual video playing'))
                        .catch(e => console.error('❌ Manual video play failed:', e));
                    }
                  } catch (error) {
                    console.error('❌ Manual camera test failed:', error);
                  }
                }}
                className="text-xs"
                variant="secondary"
                size="sm"
              >
                🔧 Test Camera
              </Button>
            </div>

            {/* Call status overlay */}
            {callState.localStream && !callState.remoteStream && (
              <div className="absolute top-4 left-4 right-4">
                <div className="bg-black/50 rounded-lg p-3 text-center">
                  <p className="text-white text-sm font-medium">{remoteUserName}</p>
                  <p className="text-white/80 text-xs">
                    {isIncoming ? 'Incoming video call' : 'Calling... waiting for them to join the chat'}
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
