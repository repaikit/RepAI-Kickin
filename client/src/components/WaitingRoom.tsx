import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { websocketService } from '@/services/websocket';
import { toast } from 'react-hot-toast';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface OnlineUser {
  id: string;
  name: string;
  user_type: string;
  avatar: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  trend: string;
  total_point: number;
  level: number;
  kicker_skills: string[];
  goalkeeper_skills: string[];
  total_kicked: number;
  kicked_win: number;
  total_keep: number;
  keep_win: number;
  is_pro: boolean;
  is_vip: boolean;
  total_extra_skill: number;
  extra_skill_win: number;
  connected_at: string;
  remaining_matches: number;
}

type PlayerType = 'basic' | 'pro' | 'vip';

interface AuthUser {
  _id: string;
  user_type: string;
  remaining_matches: number;
}

export default function WaitingRoom() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [activeTab, setActiveTab] = useState<PlayerType>('basic');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeInvite, setChallengeInvite] = useState<{ from: string, from_name: string } | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<any | null>(null);
  const [pendingChallengeUserId, setPendingChallengeUserId] = useState<string | null>(null);
  const challengeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle tab change
  const handleTabChange = (value: string) => {
    if (user?.user_type === 'guest' && value !== 'basic') {
      return; // Prevent changing to pro/vip tabs for guests
    }
    setActiveTab(value as PlayerType);
  };

  useEffect(() => {
    if (!user) return;

    const handleUserList = (users: OnlineUser[]) => {
      console.log('Received user list:', users);
      setOnlineUsers(users);
      setIsLoading(false);
    };

    const handleUserJoined = (newUser: OnlineUser) => {
      setOnlineUsers(prev => {
        if (prev.some(u => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
    };

    const handleUserLeft = (userId: string) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== userId));
    };

    const handleUserUpdated = (updatedUser: OnlineUser) => {
      setOnlineUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    };

    const handleError = (error: string) => {
      console.error('WebSocket error:', error);
      setIsLoading(false);
    };

    // Initialize WebSocket connection if not already connected
    if (!websocketService.isConnected()) {
      websocketService.connect();
    }

    // Set up WebSocket callbacks
    websocketService.setCallbacks({
      onUserList: handleUserList,
      onUserJoined: handleUserJoined,
      onUserLeft: handleUserLeft,
      onUserUpdated: handleUserUpdated,
      onError: handleError,
      onConnect: () => {
        console.log('WebSocket connected in WaitingRoom');
        setIsConnected(true);
        setError(null);
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected in WaitingRoom');
        setIsLoading(true);
        setIsConnected(false);
      },
      onChallengeInvite: (from, fromName) => {
        console.log('Received challenge_invite', from, fromName);
        setChallengeInvite({ from, from_name: fromName });
      },
      onChallengeAccepted: (matchId) => {
        setChallengeStatus('Your challenge was accepted! Starting match...');
        clearChallengeTimeout();
        toast.success('Challenge accepted! Starting match...');
        // TODO: Navigate to match page
      },
      onChallengeDeclined: () => {
        setChallengeStatus('Your challenge was declined.');
        clearChallengeTimeout();
        toast.error('Challenge was declined');
      },
      onChallengeResult: (result) => {
        setMatchResult(result);
        clearChallengeTimeout();
      }
    });

    // Cleanup function
    return () => {
      websocketService.removeCallbacks({
        onUserList: handleUserList,
        onUserJoined: handleUserJoined,
        onUserLeft: handleUserLeft,
        onUserUpdated: handleUserUpdated,
        onError: handleError,
        onConnect: () => {
          console.log('WebSocket connected in WaitingRoom');
        },
        onDisconnect: () => {
          console.log('WebSocket disconnected in WaitingRoom');
          setIsLoading(true);
        }
      });
    };
  }, [user]);

  // Timeout nếu không có phản hồi sau 10s
  useEffect(() => {
    if (pendingChallengeUserId) {
      const timeout = setTimeout(() => {
        setPendingChallengeUserId(null);
        setChallengeStatus('No response. Challenge timed out.');
        toast.error('No response. Challenge timed out.');
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [pendingChallengeUserId]);

  // Filter users based on active tab
  const filteredUsers = onlineUsers.filter(player => {
    switch (activeTab) {
      case 'basic':
        return !player.is_pro && !player.is_vip;
      case 'pro':
        return player.is_pro;
      case 'vip':
        return player.is_vip;
      default:
        return true;
    }
  });

  const handleChallenge = (userId: string) => {
    setPendingChallengeUserId(userId);
    websocketService.sendChallengeRequest(userId);
    const challengedUser = onlineUsers.find(u => u.id === userId);
    const challengedName = challengedUser ? challengedUser.name : userId;
    setChallengeStatus(`Challenge request sent to ${challengedName}`);
    toast.success(
      <span>
        <b>Challenge request sent!</b><br />
        To: <span className="text-blue-600 font-semibold">{challengedName}</span>
      </span>,
      { icon: '⚡' }
    );
    // Set timeout
    if (challengeTimeoutRef.current) clearTimeout(challengeTimeoutRef.current);
    challengeTimeoutRef.current = setTimeout(() => {
      setPendingChallengeUserId(null);
      setChallengeStatus('No response. Challenge timed out.');
      toast.error('No response. Challenge timed out.');
    }, 10000);
  };

  // Clear timeout và reset trạng thái khi có phản hồi
  const clearChallengeTimeout = () => {
    if (challengeTimeoutRef.current) {
      clearTimeout(challengeTimeoutRef.current);
      challengeTimeoutRef.current = null;
    }
    setPendingChallengeUserId(null);
  };

  useEffect(() => {
    return () => {
      if (challengeTimeoutRef.current) clearTimeout(challengeTimeoutRef.current);
    };
  }, []);

  // Challenge Status Toast tự động ẩn sau 3s
  useEffect(() => {
    if (challengeStatus) {
      const timeout = setTimeout(() => setChallengeStatus(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [challengeStatus]);

  if (!user) {
    return null;
  }

  // Sắp xếp: bản thân lên đầu
  const sortedUsers = [
    ...onlineUsers.filter(u => u.id === user._id),
    ...onlineUsers.filter(u => u.id !== user._id)
  ];

  // Chia thành các hàng, mỗi hàng 5 người
  const rows = [];
  for (let i = 0; i < sortedUsers.length; i += 5) {
    rows.push(sortedUsers.slice(i, i + 5));
  }

  const renderUserCard = (player: OnlineUser) => {
    const authUser = user as AuthUser;
    const isCurrentUser = player.id === authUser._id;
    const canChallenge = !isCurrentUser && 
                        player.user_type === authUser.user_type && 
                        player.remaining_matches > 0 && 
                        authUser.remaining_matches > 0;

    return (
      <Card key={player.id} className={`relative ${isCurrentUser ? 'border-2 border-green-500 bg-green-50' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start">
            <Avatar className="h-12 w-12 mr-3">
              <AvatarImage src={player.avatar} alt={player.name} />
              <AvatarFallback>{player.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0">
                  <h3 className="font-semibold truncate max-w-[120px]">{player.name} {isCurrentUser && <span className="text-green-600 text-xs font-semibold">(You)</span>}</h3>
                  {player.is_pro && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">PRO</Badge>}
                  {player.is_vip && <Badge variant="secondary" className="bg-purple-100 text-purple-800">VIP</Badge>}
                </div>
                <p className="text-sm text-gray-500">Level {player.level}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-500">Points</p>
              <p className="font-medium">{player.total_point}</p>
            </div>
            <div>
              <p className="text-gray-500">Matches Left</p>
              <p className="font-medium">{player.remaining_matches}</p>
            </div>
            <div>
              <p className="text-gray-500">Kicker Wins</p>
              <p className="font-medium">{player.kicked_win}/{player.total_kicked}</p>
            </div>
            <div>
              <p className="text-gray-500">Goalkeeper Wins</p>
              <p className="font-medium">{player.keep_win}/{player.total_keep}</p>
            </div>
          </div>
          {canChallenge && (
            <div className="flex justify-center mt-4">
              <Button
                onClick={() => handleChallenge(player.id)}
                className="bg-blue-500 hover:bg-blue-600 w-full md:w-40"
                disabled={pendingChallengeUserId === player.id}
              >
                {pendingChallengeUserId === player.id ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Waiting...
                  </span>
                ) : (
                  'Challenge'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Waiting Room</h2>
      
      <Tabs defaultValue="basic" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className={`grid ${user?.user_type === 'guest' ? 'w-full grid-cols-1' : 'w-full grid-cols-3'} mb-6`}>
          <TabsTrigger value="basic">Basic Players</TabsTrigger>
          {user?.user_type !== 'guest' && (
            <>
              <TabsTrigger value="pro">Pro Players</TabsTrigger>
              <TabsTrigger value="vip">VIP Players</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="basic">
          <div className="bg-white/80 rounded-xl p-6 min-h-[200px] shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {isLoading ? (
                Array(8).fill(0).map((_, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </Card>
                ))
              ) : filteredUsers.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 py-8 text-lg font-medium">No data available</div>
              ) : (
                filteredUsers.map(renderUserCard)
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pro">
          <div className="bg-white/80 rounded-xl p-6 min-h-[200px] shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {isLoading ? (
                Array(8).fill(0).map((_, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </Card>
                ))
              ) : filteredUsers.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 py-8 text-lg font-medium">No data available</div>
              ) : (
                filteredUsers.map(renderUserCard)
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vip">
          <div className="bg-white/80 rounded-xl p-6 min-h-[200px] shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {isLoading ? (
                Array(8).fill(0).map((_, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </Card>
                ))
              ) : filteredUsers.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 py-8 text-lg font-medium">No data available</div>
              ) : (
                filteredUsers.map(renderUserCard)
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Challenge Invite Modal */}
      {challengeInvite && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 transition-all">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-xs w-full text-center animate-fade-in border border-gray-200">
            <h3 className="text-lg font-bold mb-2 text-black">
              {challengeInvite?.from_name} has challenged you!
            </h3>
            <p className="mb-6 text-gray-700">Do you accept this challenge?</p>
            <div className="flex justify-center gap-4">
              <button
                className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-semibold transition shadow"
                onClick={() => {
                  if (challengeInvite) {
                    websocketService.acceptChallenge(challengeInvite.from);
                    setChallengeInvite(null);
                  }
                }}
              >
                Accept
              </button>
              <button
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-semibold transition shadow"
                onClick={() => {
                  if (challengeInvite) {
                    websocketService.declineChallenge(challengeInvite.from);
                    setChallengeInvite(null);
                  }
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
        <div className="
          fixed bottom-6 right-6 z-50
          flex items-center gap-3
          px-6 py-4
          rounded-2xl
          shadow-2xl
          border border-blue-300
          bg-gradient-to-br from-blue-500/90 to-blue-700/90
          backdrop-blur-md
          animate-fade-in
          text-white
          min-w-[260px]
          max-w-xs
          transition-all
        ">
          <span className="flex items-center justify-center bg-white/20 rounded-full p-2 shadow">
            {/* Modern SVG icon */}
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#fff" className="drop-shadow" />
            </svg>
          </span>
          <span className="flex-1 font-semibold text-base leading-tight drop-shadow">
            {challengeStatus}
          </span>
          <button
            className="ml-2 text-white/70 hover:text-white transition"
            onClick={() => setChallengeStatus(null)}
            aria-label="Close"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
              <path d="M6 6l8 8M6 14L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {matchResult && user && (
        (() => {
          const isWinner = matchResult.match_stats.winner.id === user._id;
          const myStats = isWinner ? matchResult.match_stats.winner : matchResult.match_stats.loser;
          const opponentStats = isWinner ? matchResult.match_stats.loser : matchResult.match_stats.winner;
          return (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 transition-all">
              <div className="bg-white p-0 rounded-2xl shadow-2xl max-w-lg w-full text-center animate-fade-in border border-gray-200 overflow-hidden">
                {/* Accent bar */}
                <div className={isWinner ? "h-2 bg-gradient-to-r from-green-400 to-blue-500" : "h-2 bg-gradient-to-r from-red-400 to-gray-400"} />
                <div className="p-10">
                  <h2 className={`text-3xl font-bold mb-6 ${isWinner ? 'text-green-600' : 'text-red-600'}`}>
                    {isWinner ? "Victory" : "Defeat"}
                  </h2>
                  <div className="mb-8">
                    <div className="grid grid-cols-2 gap-6 text-lg text-left">
                      <div>
                        <span className="text-gray-500">Your Role:</span>
                        <span className="font-semibold text-black ml-1">{myStats.role.charAt(0).toUpperCase() + myStats.role.slice(1)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Your Skill:</span>
                        <span className="font-semibold text-black ml-1">{myStats.role === "kicker" ? matchResult.kicker_skill : matchResult.goalkeeper_skill}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Opponent:</span>
                        <span className="font-semibold text-black ml-1">{opponentStats.name} ({opponentStats.role})</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Opponent Skill:</span>
                        <span className="font-semibold text-black ml-1">{opponentStats.role === "kicker" ? matchResult.kicker_skill : matchResult.goalkeeper_skill}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Level:</span>
                        <span className="font-semibold text-black ml-1">{myStats.level}{myStats.level_up && <span className="ml-2 text-green-600 font-bold">Level Up!</span>}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Points this match:</span>
                        <span className="font-semibold text-black ml-1">
                          {isWinner ? "+1" : "0"}
                          {myStats.is_pro && isWinner && (
                            <span className="ml-2 text-yellow-600 font-bold">+1 (Pro)</span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Points:</span>
                        <span className="font-semibold text-black ml-1">{myStats.total_point}</span>
                      </div>
                      {myStats.is_pro && (
                        <div>
                          <span className="text-gray-500">Extra Skill Points:</span>
                          <span className="font-semibold text-black ml-1">{myStats.total_extra_skill}</span>
                        </div>
                      )}
                      {myStats.new_skills && myStats.new_skills.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-500">New Skill Unlocked:</span>
                          <span className="font-semibold text-black ml-1">{myStats.new_skills.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className="mt-4 px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg transition"
                    onClick={() => setMatchResult(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}