'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseWebRTCProps {
  matchId: string;
  userId: string;
  onIncomingCall?: (fromUserId: string) => void;
  onCallEnded?: () => void;
  autoAnswerIncoming?: boolean;
}

export interface CallState {
  isConnected: boolean;
  isConnecting: boolean;
  isIncoming: boolean;
  isAnswering: boolean; // New state to track if we're answering a call
  isCaller: boolean; // Track if we initiated the call
  remoteUserId?: string;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  error?: string;
}

export function useWebRTC({ matchId, userId, onIncomingCall, onCallEnded, autoAnswerIncoming = false }: UseWebRTCProps) {
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    isConnecting: false,
    isIncoming: false,
    isAnswering: false,
    isCaller: false,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const supabase = createClient();

  // WebRTC configuration with free STUN servers
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  // Send signaling messages via Supabase
  const sendSignalingMessage = useCallback(async (message: any) => {
    try {
      await supabase
        .from('video_call_signals')
        .insert({
          match_id: matchId,
          from_user_id: message.from,
          to_user_id: message.to,
          signal_type: message.type,
          signal_data: message,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error sending signaling message:', error);
    }
  }, [matchId, supabase]);

  // End the call
  const endCall = useCallback(async () => {
    const currentRemoteUserId = callState.remoteUserId;
    const currentLocalStream = callState.localStream;
    
    // Send end-call signal to remote user if we have their ID
    if (currentRemoteUserId) {
      try {
        await sendSignalingMessage({
          type: 'end-call',
          from: userId,
          to: currentRemoteUserId,
        });
      } catch (error) {
        // Ignore signaling errors during cleanup
      }
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream tracks
    if (currentLocalStream) {
      currentLocalStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // Clear video refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Reset state
    setCallState({
      isConnected: false,
      isConnecting: false,
      isIncoming: false,
      isAnswering: false,
      isCaller: false,
      localStream: undefined,
      remoteStream: undefined,
    });

    // Notify parent component
    onCallEnded?.();
  }, [callState.remoteUserId, callState.localStream, userId, onCallEnded, sendSignalingMessage]);

  // Initialize peer connection
  const initializePeerConnection = useCallback((remoteUserId: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(rtcConfiguration);
    peerConnectionRef.current = pc;

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setCallState(prev => ({ ...prev, remoteStream }));
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.onloadedmetadata = () => {
          remoteVideoRef.current?.play().catch((error) => {
            console.error('Error playing remote video:', error);
          });
        };
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isConnecting: false,
          error: undefined 
        }));
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          from: userId,
          to: remoteUserId,
        });
      }
    };

    return pc;
  }, [userId, endCall, sendSignalingMessage]);


  // Get user media (camera and microphone)
  const getUserMedia = async (): Promise<MediaStream | null> => {
    try {
      // If we already have a stream and it's active, return it
      if (callState.localStream && callState.localStream.active) {
        return callState.localStream;
      }

      if (callState.localStream) {
        callState.localStream.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      setCallState(prev => ({ ...prev, localStream: stream }));
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current?.play().catch((error) => {
            console.error('Error playing local video:', error);
          });
        };
      }

      return stream;
    } catch (error) {
      setCallState(prev => ({ 
        ...prev, 
        error: `Could not access camera or microphone: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }));
      return null;
    }
  };

  // Start a video call
  const startCall = async (remoteUserId: string) => {
    try {
      // Prevent starting call if already in progress or answering
      if (callState.isConnecting || callState.isIncoming || callState.isAnswering) {
        return;
      }

      setCallState(prev => ({ 
        ...prev, 
        isConnecting: true, 
        remoteUserId,
        isIncoming: false,
        isAnswering: false,
        isCaller: true,
        error: undefined 
      }));

      const stream = await getUserMedia();
      if (!stream) return;

      const pc = initializePeerConnection(remoteUserId);
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignalingMessage({
        type: 'offer',
        offer: offer,
        from: userId,
        to: remoteUserId,
      });

    } catch (error) {
      setCallState(prev => ({ 
        ...prev, 
        isConnecting: false,
        error: 'Failed to start call' 
      }));
    }
  };

  // Answer an incoming call
  const answerCall = async (offer: RTCSessionDescriptionInit, fromUserId: string) => {
    try {
      setCallState(prev => ({ 
        ...prev, 
        isConnecting: true, 
        remoteUserId: fromUserId,
        isIncoming: false,
        isAnswering: true,
        isCaller: false,
        error: undefined 
      }));

      const stream = await getUserMedia();
      if (!stream) return;

      const pc = initializePeerConnection(fromUserId);
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignalingMessage({
        type: 'answer',
        answer: answer,
        from: userId,
        to: fromUserId,
      });

    } catch (error) {
      setCallState(prev => ({ 
        ...prev, 
        isConnecting: false,
        error: 'Failed to answer call' 
      }));
    }
  };

  // Check for pending offers when component mounts - only if autoAnswerIncoming
  useEffect(() => {
    const checkPendingOffers = async () => {
      if (autoAnswerIncoming) {
        try {
          const { data: pendingOffers } = await supabase
            .from('video_call_signals')
            .select('*')
            .eq('match_id', matchId)
            .eq('to_user_id', userId)
            .eq('signal_type', 'offer')
            .is('processed_at', null)
            .order('created_at', { ascending: false })
            .limit(1);

          if (pendingOffers && pendingOffers.length > 0) {
            const offer = pendingOffers[0];
            
            if (!callState.isConnected && !callState.isConnecting) {
              setCallState(prev => ({ 
                ...prev, 
                isIncoming: true,
                isAnswering: true,
                isCaller: false,
                remoteUserId: offer.from_user_id 
              }));
              
              // Mark as processed immediately
              await supabase
                .from('video_call_signals')
                .update({ processed_at: new Date().toISOString() })
                .eq('id', offer.id);
              
              answerCall(offer.signal_data.offer, offer.from_user_id);
            }
          }
        } catch (error) {
          console.error('Error checking pending offers:', error);
        }
      }
    };

    checkPendingOffers();
  }, [matchId, userId, autoAnswerIncoming, supabase]);

  // Listen for signaling messages
  useEffect(() => {
    const channel = supabase
      .channel(`video_call_${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'video_call_signals',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const signal = payload.new;
          
          if (signal.from_user_id === userId) return;

          const data = signal.signal_data;

          switch (data.type) {
            case 'offer':
              // Ignore offers if we're already connected or connecting
              if (callState.isConnected || callState.isConnecting) {
                return;
              }

              // Mark this signal as processed to prevent duplicate handling
              try {
                await supabase
                  .from('video_call_signals')
                  .update({ processed_at: new Date().toISOString() })
                  .eq('id', signal.id);
              } catch (error) {
                console.error('Error marking signal as processed:', error);
              }

              if (autoAnswerIncoming) {
                // When auto-answering, set isAnswering immediately
                setCallState(prev => ({ 
                  ...prev, 
                  isIncoming: true,
                  isAnswering: true,
                  isCaller: false,
                  remoteUserId: signal.from_user_id 
                }));
                answerCall(data.offer, signal.from_user_id);
              } else {
                setCallState(prev => ({ 
                  ...prev, 
                  isIncoming: true,
                  isCaller: false,
                  remoteUserId: signal.from_user_id 
                }));
                onIncomingCall?.(signal.from_user_id);
              }
              break;

            case 'call-accepted':
              // Update UI to show call was accepted
              setCallState(prev => ({ 
                ...prev, 
                isIncoming: false 
              }));
              break;

            case 'answer':
              if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(data.answer);
              }
              break;

            case 'ice-candidate':
              if (peerConnectionRef.current && data.candidate) {
                try {
                  await peerConnectionRef.current.addIceCandidate(data.candidate);
                } catch (error) {
                  // Ignore ICE candidate errors
                }
              }
              break;

            case 'end-call':
              endCall();
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, userId, onIncomingCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Direct cleanup without calling endCall to avoid infinite loop
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (callState.localStream) {
        callState.localStream.getTracks().forEach(track => track.stop());
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, []); // Empty dependency array to avoid infinite loop

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('🛑 useWebRTC hook unmounting - cleaning up');
      if (callState.localStream) {
        console.log('🛑 Stopping local stream on unmount');
        callState.localStream.getTracks().forEach((track, index) => {
          console.log(`🛑 Unmount: Stopping ${track.kind} track ${index}`);
          track.stop();
        });
      }
      if (peerConnectionRef.current) {
        console.log('🛑 Closing peer connection on unmount');
        peerConnectionRef.current.close();
      }
    };
  }, [callState.localStream]);

  return {
    callState,
    startCall,
    answerCall,
    endCall,
    localVideoRef,
    remoteVideoRef,
  };
}
