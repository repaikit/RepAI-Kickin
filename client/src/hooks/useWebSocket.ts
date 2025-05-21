import { useEffect, useCallback } from 'react';
import { websocketService } from '@/services/websocket';

interface WebSocketCallbacks {
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onLeaderboardUpdate?: (message: { leaderboard: any[] }) => void;
  onUserList?: (message: { users: any[] }) => void;
  onUserJoined?: (message: { user: any }) => void;
  onUserLeft?: (message: { user_id: string }) => void;
  onUserUpdated?: (message: { user_id: string; user: any }) => void;
  onChallengeInvite?: (message: { from: string; from_name: string }) => void;
  onChallengeResult?: (message: { 
    type: string;
    kicker_id: string;
    goalkeeper_id: string;
    kicker_skill: string;
    goalkeeper_skill: string;
    match_stats: any;
  }) => void;
}

export const useWebSocket = (callbacks: WebSocketCallbacks = {}) => {
  const sendMessage = useCallback((message: any) => {
    websocketService.sendMessage(message);
  }, []);

  const sendChallengeRequest = useCallback((toId: string) => {
    websocketService.sendChallengeRequest(toId);
  }, []);

  const acceptChallenge = useCallback((fromId: string) => {
    websocketService.acceptChallenge(fromId);
  }, []);

  const declineChallenge = useCallback((fromId: string) => {
    websocketService.declineChallenge(fromId);
  }, []);

  const sendUserUpdate = useCallback((userData: any) => {
    websocketService.sendUserUpdate(userData);
  }, []);

  useEffect(() => {
    // Set up callbacks
    websocketService.setCallbacks(callbacks);

    // Connect if not already connected
    if (!websocketService.isConnected()) {
      websocketService.connect();
    }

    // Cleanup on unmount
    return () => {
      websocketService.removeCallbacks(callbacks);
    };
  }, [callbacks]);

  return {
    sendMessage,
    sendChallengeRequest,
    acceptChallenge,
    declineChallenge,
    sendUserUpdate,
    isConnected: websocketService.isConnected(),
  };
}; 