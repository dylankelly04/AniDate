'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseWebRTCProps {
  matchId: string;
  userId: string;
  onIncomingCall?: (fromUserId: string) => void;
  onCallEnded?: () => void;
}

export interface CallState {
  isConnected: boolean;
  isConnecting: boolean;
  isIncoming: boolean;
  remoteUserId?: string;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  error?: string;
}

export function useWebRTC({ matchId, userId, onIncomingCall, onCallEnded }: UseWebRTCProps) {
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    isConnecting: false,
    isIncoming: false,
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

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
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
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      
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
          to: callState.remoteUserId,
        });
      }
    };

    return pc;
  }, [userId, callState.remoteUserId]);

  // Send signaling messages via Supabase
  const sendSignalingMessage = async (message: any) => {
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
  };

  // Get user media (camera and microphone)
  const getUserMedia = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setCallState(prev => ({ ...prev, localStream: stream }));
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setCallState(prev => ({ 
        ...prev, 
        error: 'Could not access camera or microphone' 
      }));
      return null;
    }
  };

  // Start a video call
  const startCall = async (remoteUserId: string) => {
    try {
      setCallState(prev => ({ 
        ...prev, 
        isConnecting: true, 
        remoteUserId,
        error: undefined 
      }));

      const stream = await getUserMedia();
      if (!stream) return;

      const pc = initializePeerConnection();
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignalingMessage({
        type: 'offer',
        offer: offer,
        from: userId,
        to: remoteUserId,
      });

    } catch (error) {
      console.error('Error starting call:', error);
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
        error: undefined 
      }));

      const stream = await getUserMedia();
      if (!stream) return;

      const pc = initializePeerConnection();
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Set remote description and create answer
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
      console.error('Error answering call:', error);
      setCallState(prev => ({ 
        ...prev, 
        isConnecting: false,
        error: 'Failed to answer call' 
      }));
    }
  };

  // End the call
  const endCall = useCallback(() => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (callState.localStream) {
      callState.localStream.getTracks().forEach(track => track.stop());
    }

    // Reset state
    setCallState({
      isConnected: false,
      isConnecting: false,
      isIncoming: false,
    });

    // Notify parent component
    onCallEnded?.();
  }, [callState.localStream, onCallEnded]);

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
          
          // Ignore our own messages
          if (signal.from_user_id === userId) return;

          const data = signal.signal_data;

          switch (data.type) {
            case 'offer':
              setCallState(prev => ({ 
                ...prev, 
                isIncoming: true, 
                remoteUserId: signal.from_user_id 
              }));
              onIncomingCall?.(signal.from_user_id);
              break;

            case 'answer':
              if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(data.answer);
              }
              break;

            case 'ice-candidate':
              if (peerConnectionRef.current && data.candidate) {
                await peerConnectionRef.current.addIceCandidate(data.candidate);
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
  }, [matchId, userId, onIncomingCall, endCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    callState,
    startCall,
    answerCall,
    endCall,
    localVideoRef,
    remoteVideoRef,
  };
}
