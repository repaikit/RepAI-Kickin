import React, { createContext, useContext, useEffect, useState } from 'react';
import { websocketService } from '@/services/websocket';

interface WebSocketContextValue {
  onlineUsers: any[];
  leaderboard: any[];
}

const WebSocketContext = createContext<WebSocketContextValue>({
  onlineUsers: [],
  leaderboard: [],
});

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const handleUserList = (users: any[]) => {
      console.log('WebSocketContext: Received user list', users);
      setOnlineUsers(users);
    };

    const handleUserUpdated = (user: any) => {
      console.log('WebSocketContext: User updated', user);
      setOnlineUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...user } : u));
      setLeaderboard(prev => prev.map(u => u.id === user.id ? { ...u, ...user } : u));
    };

    const handleUserJoined = (user: any) => {
      console.log('WebSocketContext: User joined', user);
      setOnlineUsers(prev => [...prev, user]);
    };

    const handleUserLeft = (userId: string) => {
      console.log('WebSocketContext: User left', userId);
      setOnlineUsers(prev => prev.filter(u => u.id !== userId));
    };

    websocketService.setCallbacks({
      onUserList: handleUserList,
      onUserUpdated: handleUserUpdated,
      onUserJoined: handleUserJoined,
      onUserLeft: handleUserLeft,
      onLeaderboardUpdate: (msg: any) => {
        console.log('WebSocketContext: Leaderboard update', msg);
        setLeaderboard(msg.leaderboard);
      },
    });

    return () => {
      websocketService.removeCallbacks({
        onUserList: handleUserList,
        onUserUpdated: handleUserUpdated,
        onUserJoined: handleUserJoined,
        onUserLeft: handleUserLeft,
        onLeaderboardUpdate: (msg: any) => {
          setLeaderboard(msg.leaderboard);
        },
      });
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ onlineUsers, leaderboard }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketData = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketData must be used within a WebSocketProvider');
  }
  return context;
}; 