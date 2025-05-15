import { useEffect, useState, useRef } from 'react';
import { useGuestUser } from './useGuestUser';
import { WS_BASE_URL } from '@/config/api';

interface WaitingRoomUser {
  user_id: string;
  name: string;
  type: string;
  avatar: string;
  wins: number;
  losses: number;
  connected_at: string;
  remaining_matches: number;
}

export const useWaitingRoom = () => {
  const { guestUser } = useGuestUser();
  const [users, setUsers] = useState<WaitingRoomUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!guestUser?._id) return;

    let pingInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      const ws = new WebSocket(`${WS_BASE_URL}/api/ws/waitingroom/${guestUser._id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Start ping interval
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 3000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        // Handle pong message
        if (data.type === 'pong') {
          return;
        }

        switch (data.type) {
          case 'user_list': {
            // Map backend fields to WaitingRoomUser
            const mappedUsers = (data.users || []).map((u: any) => ({
              user_id: u.id || u.user_id || u._id,
              name: u.name,
              type: u.type,
              avatar: u.avatar || 'https://via.placeholder.com/150',
              wins: u.wins ?? 0,
              losses: u.losses ?? 0,
              connected_at: u.connected_at || '',
              remaining_matches: u.remaining_matches ?? 0,
            }));
            console.log('Mapped user list:', mappedUsers);
            setUsers(mappedUsers);
            break;
          }
          case 'user_joined': {
            const newUser = {
              user_id: data.user.id,
              name: data.user.name,
              type: data.user.type,
              avatar: data.user.avatar || 'https://via.placeholder.com/150',
              wins: data.user.wins ?? 0,
              losses: data.user.losses ?? 0,
              connected_at: data.user.connected_at,
              remaining_matches: data.user.remaining_matches ?? 0,
            };
            setUsers(prevUsers => {
              if (prevUsers.some(u => u.user_id === newUser.user_id)) return prevUsers;
              return [...prevUsers, newUser];
            });
            break;
          }
          case 'user_left': {
            setUsers(prevUsers => prevUsers.filter(user => user.user_id !== data.user_id));
            break;
          }
          case 'status':
            setUsers(prevUsers =>
              prevUsers.map(user =>
                user.user_id === data.user_id
                  ? { ...user, ...data.user }
                  : user
              )
            );
            break;
          case 'challenge':
            console.log('Challenge received:', data);
            break;
          case 'challenge_rejected':
            console.log('Challenge rejected:', data);
            break;
          case 'match_ready':
            console.log('Match ready:', data);
            break;
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        if (pingInterval) {
          clearInterval(pingInterval);
        }
        
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        
        // Thử kết nối lại sau 5 giây
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error details:', error);
        ws.close(); // Đóng kết nối để kích hoạt kết nối lại
      };
    };

    connectWebSocket();

    return () => {
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
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