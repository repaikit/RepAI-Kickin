import { createContext, useContext, useEffect, useState } from 'react';
import { websocketService, LeaderboardEntry } from '@/services/websocket';

interface WebSocketContextValue {
  isConnected: boolean;
  leaderboard: LeaderboardEntry[];
  users: any[];
  error: string | null;
  sendMessage: (message: any) => void;
  sendChallengeRequest: (toId: string) => void;
  acceptChallenge: (fromId: string) => void;
  declineChallenge: (fromId: string) => void;
  sendUserUpdate: (userData: any) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  leaderboard: [],
  users: [],
  error: null,
  sendMessage: () => {},
  sendChallengeRequest: () => {},
  acceptChallenge: () => {},
  declineChallenge: () => {},
  sendUserUpdate: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (errorMessage: string) => {
      console.error('WebSocketContext: Error occurred:', errorMessage);
      setError(errorMessage);
    };

    const handleConnect = () => {
      console.log('WebSocketContext: Connected');
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnect = () => {
      console.log('WebSocketContext: Disconnected');
      setIsConnected(false);
    };

    const handleLeaderboardUpdate = (message: { leaderboard: LeaderboardEntry[] }) => {
      console.log('WebSocketContext: Leaderboard update received', message);
      if (!message.leaderboard || !Array.isArray(message.leaderboard)) {
        console.error('WebSocketContext: Invalid leaderboard data', message);
        return;
      }
      console.log('WebSocketContext: Setting new leaderboard data:', {
        count: message.leaderboard.length,
        data: message.leaderboard
      });
      console.log('WebSocketContext: Current leaderboard state:', leaderboard);
      const newLeaderboard = Array.isArray(message.leaderboard) ? [...message.leaderboard] : [];
      console.log('WebSocketContext: New leaderboard data to set:', newLeaderboard);
      setLeaderboard(newLeaderboard);
      console.log('WebSocketContext: Leaderboard state updated');
    };

    const handleUserList = (message: { users: any[] }) => {
      console.log('WebSocketContext: User list received', message);
      if (!message.users || !Array.isArray(message.users)) {
        console.error('WebSocketContext: Invalid user list data', message);
        return;
      }
      console.log('WebSocketContext: Setting new user list:', {
        count: message.users.length,
        users: message.users
      });
      setUsers(message.users);
    };

    const handleUserJoined = (message: { user: any }) => {
      console.log('WebSocketContext: User joined', message);
      setUsers(prev => [...prev, message.user]);
    };

    const handleUserLeft = (message: { user_id: string }) => {
      console.log('WebSocketContext: User left', message);
      setUsers(prev => prev.filter(user => user.id !== message.user_id));
    };

    // Set up WebSocket callbacks
    websocketService.setCallbacks({
      onError: handleError,
      onConnect: handleConnect,
      onDisconnect: handleDisconnect,
      onLeaderboardUpdate: handleLeaderboardUpdate,
      onUserList: handleUserList,
      onUserJoined: handleUserJoined,
      onUserLeft: handleUserLeft,
    });

    // Connect to WebSocket
    websocketService.connect();

    // Cleanup on unmount
    return () => {
      websocketService.removeCallbacks({
        onError: handleError,
        onConnect: handleConnect,
        onDisconnect: handleDisconnect,
        onLeaderboardUpdate: handleLeaderboardUpdate,
        onUserList: handleUserList,
        onUserJoined: handleUserJoined,
        onUserLeft: handleUserLeft,
      });
      websocketService.disconnect();
    };
  }, []);

  const value = {
    isConnected,
    leaderboard,
    users,
    error,
    sendMessage: websocketService.sendMessage.bind(websocketService),
    sendChallengeRequest: websocketService.sendChallengeRequest.bind(websocketService),
    acceptChallenge: websocketService.acceptChallenge.bind(websocketService),
    declineChallenge: websocketService.declineChallenge.bind(websocketService),
    sendUserUpdate: websocketService.sendUserUpdate.bind(websocketService),
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}; 