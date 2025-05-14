import { useEffect, useState, useRef } from 'react';
import { useGuestUser } from './useGuestUser';
import { WS_BASE_URL } from '@/config/api';

interface WaitingRoomUser {
  user_id: string;
  name: string;
  user_type: string;
  kicker_skills: string[];
  goalkeeper_skills: string[];
  remaining_matches: number;
  is_ready: boolean;
  avatar?: string;
}

export const useWaitingRoom = () => {
  const { guestUser } = useGuestUser();
  const [users, setUsers] = useState<WaitingRoomUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!guestUser?._id) return;

    const connectWebSocket = () => {
      const ws = new WebSocket(`${WS_BASE_URL}/api/ws/waitingroom/${guestUser._id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        switch (data.type) {
          case 'user_list':
            console.log('Received user list:', data.users);
            setUsers(data.users);
            break;
          case 'status':
            console.log('Received status update:', data);
            setUsers(prevUsers => 
              prevUsers.map(user => 
                user.user_id === data.user_id 
                  ? { ...user, ...data.user }
                  : user
              )
            );
            break;
          case 'challenge':
            // Handle challenge request
            console.log('Challenge received:', data);
            break;
          case 'challenge_rejected':
            // Handle challenge rejection
            console.log('Challenge rejected:', data);
            break;
          case 'match_ready':
            // Handle match ready
            console.log('Match ready:', data);
            break;
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        // Try to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [guestUser?._id]);

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const setReady = (isReady: boolean) => {
    sendMessage({
      type: 'ready',
      is_ready: isReady
    });
  };

  const sendChallenge = (targetUserId: string, matchType: string = 'friendly', position: string = 'both') => {
    sendMessage({
      type: 'challenge',
      target_user_id: targetUserId,
      match_type: matchType,
      position: position
    });
  };

  const respondToChallenge = (targetUserId: string, accepted: boolean, matchType: string = 'friendly', position: string = 'both') => {
    sendMessage({
      type: 'challenge_response',
      target_user_id: targetUserId,
      accepted,
      match_type: matchType,
      position: position
    });
  };

  return {
    users,
    isConnected,
    setReady,
    sendChallenge,
    respondToChallenge
  };
}; 