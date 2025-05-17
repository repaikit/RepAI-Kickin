import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!user) return;

    const handleUserList = (users: OnlineUser[]) => {
      console.log('Received user list:', users);
      setOnlineUsers(users);
      setIsLoading(false);
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
        toast.success('Challenge accepted! Starting match...');
        // TODO: Navigate to match page
      },
      onChallengeDeclined: () => {
        setChallengeStatus('Your challenge was declined.');
        toast.error('Challenge was declined');
      },
      onChallengeResult: (result) => {
        console.log('Received challenge_result', result);
        setMatchResult(result);
      }
    });

    // Cleanup function
    return () => {
      websocketService.removeCallbacks({
        onUserList: handleUserList,
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
    websocketService.sendChallengeRequest(userId);
    setChallengeStatus(`Challenge request sent to ${userId}`);
    toast.success(`Challenge request sent to ${userId}`);
  };

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
            <div className="col-span-2 mt-2">
              <p className="text-gray-500">Reward</p>
              <p className="font-medium">
                {player.is_vip ? '30 → 20 USDC' : player.is_pro ? '20 → 10 USDC' : '10 → 1 USDC'}
              </p>
            </div>
          </div>
          {canChallenge && (
            <div className="flex justify-center mt-4">
              <Button
                onClick={() => handleChallenge(player.id)}
                className="bg-blue-500 hover:bg-blue-600 w-full md:w-40"
              >
                Challenge
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
      
      <Tabs defaultValue="basic" value={activeTab} onValueChange={(value) => setActiveTab(value as PlayerType)}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="basic">Basic Players</TabsTrigger>
          <TabsTrigger value="pro">Pro Players</TabsTrigger>
          <TabsTrigger value="vip">VIP Players</TabsTrigger>
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
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg">
            <p className="mb-4 font-medium">
              {challengeInvite?.from_name} has challenged you! Accept?
            </p>
            <div className="flex space-x-4">
              <button
                className="px-4 py-2 bg-green-500 text-white rounded"
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
                className="px-4 py-2 bg-red-500 text-white rounded"
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
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow z-50">
          {challengeStatus}
          <button className="ml-2" onClick={() => setChallengeStatus(null)}>x</button>
        </div>
      )}

      {matchResult && user && (
        (() => {
          const isWinner = matchResult.match_stats.winner.id === user._id;
          const myStats = isWinner ? matchResult.match_stats.winner : matchResult.match_stats.loser;
          const opponentStats = isWinner ? matchResult.match_stats.loser : matchResult.match_stats.winner;
          return (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
              <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
                <h2 className="text-xl font-bold mb-2 text-center">
                  {isWinner ? "You Win!" : "You Lose!"}
                </h2>
                <div className="mb-2">
                  <b>Your Role:</b> {myStats.role.charAt(0).toUpperCase() + myStats.role.slice(1)}<br />
                  <b>Your Skill:</b> {myStats.role === "kicker" ? matchResult.kicker_skill : matchResult.goalkeeper_skill}
                </div>
                <div className="mb-2">
                  <b>Opponent:</b> {opponentStats.name} ({opponentStats.role})<br />
                  <b>Opponent Skill:</b> {opponentStats.role === "kicker" ? matchResult.kicker_skill : matchResult.goalkeeper_skill}
                </div>
                <div className="mb-2">
                  <b>Level:</b> {myStats.level}
                  {myStats.level_up && (
                    <span className="ml-2 text-green-600 font-bold">Level Up!</span>
                  )}
                  {myStats.new_skills && myStats.new_skills.length > 0 && (
                    <div>
                      <b>New Skill Unlocked:</b> {myStats.new_skills.join(', ')}
                    </div>
                  )}
                </div>
                <div className="mb-2">
                  <b>Points this match:</b> {isWinner ? "+1" : "0"}
                  {myStats.is_pro && isWinner && (
                    <>
                      {" "}+1 <span className="text-yellow-600 font-bold">(Extra Point for Pro)</span>
                    </>
                  )}
                  <br />
                  <b>Total Points:</b> {myStats.total_point}
                  {myStats.is_pro && (
                    <div>
                      <b>Total Extra Skill Points:</b> {myStats.total_extra_skill}
                    </div>
                  )}
                </div>
                <button
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
                  onClick={() => setMatchResult(null)}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}