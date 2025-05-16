import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { websocketService } from '@/services/websocket';
import { toast } from 'react-hot-toast';

interface OnlineUser {
  id: string;
  name: string;
  type: string;
  avatar: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  trend: string;
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
  const [challengeInvite, setChallengeInvite] = useState<{ from: string, from_name: string } | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Set up WebSocket callbacks
    websocketService.setCallbacks({
      onConnect: () => {
        setIsConnected(true);
        setError(null);
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onError: (message) => {
        setError(message);
        toast.error(message);
      },
      onUserList: (users) => {
        setOnlineUsers(users);
      },
      onChallengeInvite: (from, fromName) => {
        console.log('Received challenge_invite', from, fromName);
        setChallengeInvite({ from, from_name: fromName });
      },
      onChallengeAccepted: (matchId) => {
        setChallengeStatus('Your challenge was accepted! Starting match...');
        toast.success('Challenge accepted! Starting match...');
        // TODO: Navigate to match page
      },
      onChallengeDeclined: () => {
        setChallengeStatus('Your challenge was declined.');
        toast.error('Challenge was declined');
      }
    });

    // Connect to WebSocket
    websocketService.connect();

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
    };
  }, [user]);

  const handleChallenge = (targetUser: OnlineUser) => {
    websocketService.sendChallengeRequest(targetUser.id);
    setChallengeStatus(`Challenge request sent to ${targetUser.name}`);
    toast.success(`Challenge request sent to ${targetUser.name}`);
  };

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
        {onlineUsers.filter(u => u.id !== user._id).length === 0 ? (
          <div className="text-center text-slate-500 py-4">
            No other players in the waiting room
          </div>
        ) : (
          onlineUsers.filter(u => u.id !== user._id).map((user) => (
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
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>Kicker: {user.kicked_win}/{user.total_kicked}</span>
                    <span>•</span>
                    <span>Goalkeeper: {user.keep_win}/{user.total_keep}</span>
                  </div>
                </div>
              </div>
              <button
                className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                onClick={() => handleChallenge(user)}
              >
                Challenge
              </button>
            </div>
          ))
        )}
      </div>

      {/* Challenge Invite Modal */}
      {challengeInvite && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg">
            <p className="mb-4 font-medium">
              {challengeInvite.from_name} has challenged you! Accept?
            </p>
            <div className="flex space-x-4">
              <button
                className="px-4 py-2 bg-green-500 text-white rounded"
                onClick={() => {
                  websocketService.acceptChallenge(challengeInvite.from);
                  setChallengeInvite(null);
                }}
              >
                Accept
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white rounded"
                onClick={() => {
                  websocketService.declineChallenge(challengeInvite.from);
                  setChallengeInvite(null);
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Status Toast */}
      {challengeStatus && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow z-50">
          {challengeStatus}
          <button className="ml-2" onClick={() => setChallengeStatus(null)}>x</button>
        </div>
      )}
    </div>
  );
}