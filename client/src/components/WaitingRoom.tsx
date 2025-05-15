import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ENDPOINTS } from '@/config/api';

interface OnlineUser {
  id: string;
  name: string;
  type: string;
  avatar: string;
  position: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  trend: string;
  remaining_matches: number;
  point: number;
  level: number;
  kicker_skills: string[];
  goalkeeper_skills: string[];
  total_kicked: number;
  kicked_win: number;
  total_keep: number;
  keep_win: number;
  is_pro: boolean;
  total_extra_skill: number;
  extra_skill_win: number;
  connected_at: string;
}

export default function WaitingRoom() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!user) return;

    // Get access token from localStorage
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setError('No access token found');
      return;
    }

    console.log('Connecting to WebSocket...');
    // Connect to WebSocket with access token
    const wsUrl = `${API_ENDPOINTS.ws.waitingRoom}?access_token=${accessToken}`;
    console.log('WebSocket URL:', wsUrl);
    
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
      setError(null);
    };

    websocket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error');
    };

    websocket.onmessage = (event) => {
      console.log('Received message:', event.data);
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'user_list':
          console.log('Received user list:', message.users);
          setOnlineUsers(message.users);
          break;
        case 'user_joined':
          console.log('User joined:', message.user);
          setOnlineUsers(prev => [...prev, message.user]);
          break;
        case 'user_left':
          console.log('User left:', message.user_id);
          setOnlineUsers(prev => prev.filter(u => u.id !== message.user_id));
          break;
        case 'ping':
          console.log('Received ping, sending pong');
          websocket.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    };

    setWs(websocket);

    return () => {
      console.log('Cleaning up WebSocket connection');
      websocket.close();
    };
  }, [user]);

  // Log state mỗi lần onlineUsers thay đổi
  useEffect(() => {
    console.log('Online users state:', onlineUsers);
  }, [onlineUsers]);

  if (!user) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Waiting Room</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-slate-500">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}

      <div className="space-y-3">
        {onlineUsers.length === 0 ? (
          <div className="text-center text-slate-500 py-4">
            No players online
          </div>
        ) : (
          onlineUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-primary font-medium">
                    {user.name[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-slate-900 truncate">
                    {user.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                    {user.type}
                  </span>
                  {user.is_pro && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                      PRO
                    </span>
                  )}
                  {user.is_verified && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Verified
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span>Level {user.level}</span>
                    <span>•</span>
                    <span>{user.point} points</span>
                    <span>•</span>
                    <span>{user.remaining_matches} matches left</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>Kicker: {user.kicked_win}/{user.total_kicked}</span>
                    <span>•</span>
                    <span>Goalkeeper: {user.keep_win}/{user.total_keep}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>Position: {user.position}</span>
                    <span>•</span>
                    <span>Trend: {user.trend}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}