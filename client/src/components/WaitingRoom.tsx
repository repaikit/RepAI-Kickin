import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { websocketService } from "@/services/websocket";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import BotCard from "./BotCard";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import AutoPlayVIP from "./AutoPlayVIP";
import { useVictoryNFT } from "@/hooks/useVictoryNFT";
import { Progress } from "@/components/ui/progress";
import { Trophy, Gift } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccount } from 'wagmi';
import { useWallet } from '@/hooks/useWallet';

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

type PlayerType = "basic" | "pro" | "vip";

interface AuthUser {
  _id: string;
  user_type: string;
  remaining_matches: number;
}

interface User {
  id: string;
  name: string;
  avatar: string;
  is_online: boolean;
  is_playing: boolean;
}

interface ChallengeResultMessage {
  type: string;
  kicker_id: string;
  goalkeeper_id: string;
  kicker_skill: string;
  goalkeeper_skill: string;
  match_stats: any;
}

const AVAILABLE_CHAINS = [
  { id: 'base-sepolia', name: 'Base Sepolia', description: 'Ethereum L2 Testnet' },
  { id: 'avalanche-fuji', name: 'Avalanche Fuji', description: 'Avalanche Testnet' }
];

export default function WaitingRoom() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [activeTab, setActiveTab] = useState<PlayerType>("basic");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeInvite, setChallengeInvite] = useState<{
    from: string;
    from_name: string;
  } | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<any | null>(null);
  const [pendingChallengeUserId, setPendingChallengeUserId] = useState<
    string | null
  >(null);
  const challengeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [botSkills, setBotSkills] = useState<{
    kicker_skills: string[];
    goalkeeper_skills: string[];
  }>({
    kicker_skills: [],
    goalkeeper_skills: [],
  });
  const [users, setUsers] = useState<User[]>([]);
  const { 
    isEligible, 
    nextMilestone, 
    progress, 
    isMinting, 
    mintVictoryNFT, 
    hasJustReachedMilestone,
    getVictoryStats 
  } = useVictoryNFT(user);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [showChainModal, setShowChainModal] = useState(false);
  const { address } = useAccount();
  const { connect, connectors, isConnecting } = useWallet(user);
  const [showConnectWallet, setShowConnectWallet] = useState(false);

  const {
    sendMessage,
    sendChallengeRequest,
    acceptChallenge,
    declineChallenge,
    sendUserUpdate,
  } = useWebSocket({
    onUserList: (message) => {
      console.log("WebSocket User List Message:", message);
      if (!message.users || !Array.isArray(message.users)) {
        console.error("WaitingRoom: Invalid user list format:", message);
        return;
      }
      const uniqueUsers = message.users.filter(
        (user, index, self) => index === self.findIndex((u) => u.id === user.id)
      );

      setOnlineUsers(uniqueUsers);
      setUsers(
        uniqueUsers.map((u) => ({
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          is_online: u.is_online,
          is_playing: u.is_playing,
        }))
      );
      setIsLoading(false);
    },
    onUserJoined: (message) => {
      const newUser = message.user;
      setOnlineUsers((prev) => {
        // Check if user already exists
        if (prev.some((u) => u.id === newUser.id)) {
          return prev;
        }
        return [...prev, newUser];
      });
      setUsers((prev) => {
        // Check if user already exists
        if (prev.some((u) => u.id === newUser.id)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: newUser.id,
            name: newUser.name,
            avatar: newUser.avatar,
            is_online: newUser.is_online,
            is_playing: newUser.is_playing,
          },
        ];
      });
    },
    onUserLeft: (message) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== message.user_id));
      setUsers((prev) => prev.filter((u) => u.id !== message.user_id));
    },
    onUserUpdated: (message) => {
      setOnlineUsers((prev) =>
        prev.map((u) => (u.id === message.user_id ? message.user : u))
      );
    },
    onChallengeInvite: (message) => {
      setChallengeInvite({ from: message.from, from_name: message.from_name });
    },
    onChallengeResult: (message) => {
      if (message.kicker_id && message.goalkeeper_id) {
        setChallengeStatus("Match created! Starting game...");
        clearChallengeTimeout();
        toast.success("Match created! Starting game...");
        setMatchResult(message);
      } else {
        setChallengeStatus("Your challenge was declined.");
        clearChallengeTimeout();
        toast.error("Challenge was declined");
      }
    },
    onError: (errorMessage) => {
      console.error("WaitingRoom: WebSocket error:", errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    },
    onConnect: () => {
      setIsConnected(true);
      setError(null);
      // Request user list when connected
      sendMessage({ type: "get_user_list" });
    },
    onDisconnect: () => {
      setIsLoading(true);
      setIsConnected(false);
    },
  });

  // Add effect to request user list periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        sendMessage({ type: "get_user_list" });
      }
    }, 30000); // Request every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  useEffect(() => {
    if (pendingChallengeUserId) {
      const timeout = setTimeout(() => {
        setPendingChallengeUserId(null);
        setChallengeStatus("No response. Challenge timed out.");
        toast.error("No response. Challenge timed out.");
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [pendingChallengeUserId]);

  const filteredUsers = onlineUsers.filter((player) => {
    switch (activeTab) {
      case "basic":
        return !player.is_pro && !player.is_vip;
      case "pro":
        return player.is_pro;
      case "vip":
        return player.is_vip;
      default:
        return true;
    }
  });

  const handleTabChange = (value: string) => {
    if (user?.user_type === "guest" && value !== "basic") {
      return; // Prevent changing to pro/vip tabs for guests
    }
    setActiveTab(value as PlayerType);
  };

  const handleAcceptChallenge = () => {
    if (challengeInvite) {
      acceptChallenge(challengeInvite.from);
      setChallengeInvite(null);
    }
  };

  const handleDeclineChallenge = () => {
    if (challengeInvite) {
      declineChallenge(challengeInvite.from);
      setChallengeInvite(null);
    }
  };

  const handleChallenge = (userId: string) => {
    // Clear any existing timeout
    if (challengeTimeoutRef.current) {
      clearTimeout(challengeTimeoutRef.current);
      challengeTimeoutRef.current = null;
    }

    setPendingChallengeUserId(userId);
    sendChallengeRequest(userId);
    const challengedUser = onlineUsers.find((u) => u.id === userId);
    const challengedName = challengedUser ? challengedUser.name : userId;
    setChallengeStatus(`Challenge request sent to ${challengedName}`);
    toast.success(
      <span>
        <b>Challenge request sent!</b>
        <br />
        To:{" "}
        <span className="text-blue-600 font-semibold">{challengedName}</span>
      </span>,
      { icon: "⚡" }
    );

    // Set timeout
    challengeTimeoutRef.current = setTimeout(() => {
      setPendingChallengeUserId(null);
      setChallengeStatus("No response. Challenge timed out.");
      toast.error("No response. Challenge timed out.");
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
      if (challengeTimeoutRef.current)
        clearTimeout(challengeTimeoutRef.current);
    };
  }, []);

  // Challenge Status Toast tự động ẩn sau 3s
  useEffect(() => {
    if (challengeStatus) {
      const timeout = setTimeout(() => setChallengeStatus(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [challengeStatus]);

  // Add new effect to fetch bot skills
  useEffect(() => {
    const fetchBotSkills = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          // alert('Access token not found!');
          return;
        }
        const response = await fetch(API_ENDPOINTS.bot.getSkills, {
          method: "GET",
          headers: {
            ...defaultFetchOptions.headers,
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setBotSkills(data);
      } catch (error) {
        console.error("Error fetching bot skills:", error);
      }
    };
    fetchBotSkills();
  }, []);

  // Add handler for playing with bot
  const handlePlayWithBot = () => {
    sendChallengeRequest("bot");
    toast.success("Starting match with Bot...");
    // TODO: Navigate to match page
  };

  useEffect(() => {
    // Send user update when component mounts
    if (user) {
      sendUserUpdate({
        id: user._id,
        name: user.name,
        avatar: user.avatar,
        is_online: true,
        is_playing: false,
      });
    }

    // Cleanup when component unmounts
    return () => {
      if (user) {
        sendUserUpdate({
          id: user._id,
          name: user.name,
          avatar: user.avatar,
          is_online: false,
          is_playing: false,
        });
      }
    };
  }, [user, sendUserUpdate]);

  useEffect(() => {
    console.log("Online Users:", onlineUsers);
    console.log("Filtered VIP Users:", filteredUsers);
  }, [onlineUsers, activeTab]);

  // Check for Victory NFT milestone when match result is shown
  useEffect(() => {
    if (matchResult && user && hasJustReachedMilestone()) {
      toast.success(`🎉 Congratulations! You've reached ${nextMilestone} wins! You can now mint a Victory NFT!`);
    }
  }, [matchResult, user, hasJustReachedMilestone, nextMilestone]);

  // Fetch chain from backend on mount
  useEffect(() => {
    if (user?._id) {
      fetch(`/api/victory_nft/get-chain?user_id=${user._id}`)
        .then(res => res.json())
        .then(data => {
          if (data?.chain_id) setSelectedChain(data.chain_id);
        });
    }
  }, [user?._id]);

  // Khi user sắp milestone (9/10, 19/20...), hiện popup chọn chain nếu chưa chọn
  useEffect(() => {
    if (!user) return;
    const totalWins = (user.kicked_win || 0) + (user.keep_win || 0);
    if (totalWins > 0 && totalWins % 10 === 9 && !selectedChain) {
      setShowChainModal(true);
    }
  }, [user, selectedChain]);

  // Khi user đạt milestone, tự động mint NFT nếu đã chọn chain và đã connect wallet
  useEffect(() => {
    if (!user) return;
    const totalWins = (user.kicked_win || 0) + (user.keep_win || 0);
    // Nếu vừa đạt milestone
    if (matchResult && hasJustReachedMilestone()) {
      // Nếu chưa chọn chain, hiện popup chọn chain
      if (!selectedChain) {
        setShowChainModal(true);
        return;
      }
      // Nếu chưa connect wallet, hiện popup connect wallet
      if (!address) {
        setShowConnectWallet(true);
        return;
      }
      // Đủ điều kiện, tự động gọi mint
      mintVictoryNFT(selectedChain ?? undefined);
      toast.success(`Minting Victory NFT on ${AVAILABLE_CHAINS.find(c => c.id === selectedChain)?.name}`);
    }
  }, [matchResult, user, selectedChain, hasJustReachedMilestone, mintVictoryNFT, address]);

  // Hàm lưu chain lên backend
  const saveChainToBackend = async (chainId: string) => {
    if (!user?._id) return;
    await fetch('/api/victory_nft/set-chain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user._id, chain_id: chainId })
    });
    setSelectedChain(chainId);
  };

  // UI popup chọn chain
  const renderChainModal = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in border-2 border-yellow-300 overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-yellow-800 flex items-center gap-2">
            <span>Chọn blockchain để mint Victory NFT milestone tiếp theo</span>
          </h2>
          <Select value={selectedChain ?? undefined} onValueChange={async (val) => {
            await saveChainToBackend(val);
            setShowChainModal(false);
          }}>
            <SelectTrigger className="w-full mb-4">
              <SelectValue placeholder="Chọn blockchain" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_CHAINS.map((chain) => (
                <SelectItem key={chain.id} value={chain.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{chain.name}</span>
                    <span className="text-xs text-gray-500">{chain.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            className="mt-4 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-base w-full"
            onClick={() => setShowChainModal(false)}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  // UI popup connect wallet
  const renderConnectWalletModal = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in border-2 border-blue-300 overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-blue-800 flex items-center gap-2">
            <span>Kết nối ví để mint Victory NFT</span>
          </h2>
          {connectors.map((connector) => (
            <button
              key={connector.id}
              className="w-full mb-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-base"
              onClick={() => connect({ connector })}
              disabled={isConnecting}
            >
              Kết nối với {connector.name}
            </button>
          ))}
          <button
            className="mt-4 px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold text-base w-full"
            onClick={() => setShowConnectWallet(false)}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  if (!user) {
    return null;
  }

  // Sắp xếp: bản thân lên đầu
  const sortedUsers = [
    ...onlineUsers.filter((u) => u.id === user._id),
    ...onlineUsers.filter((u) => u.id !== user._id),
  ];

  // Chia thành các hàng, mỗi hàng 5 người
  const rows = [];
  for (let i = 0; i < sortedUsers.length; i += 5) {
    rows.push(sortedUsers.slice(i, i + 5));
  }

  const renderUserCard = (player: OnlineUser) => {
    const authUser = user as AuthUser;
    const isCurrentUser = player.id === authUser._id;
    const canChallenge =
      !isCurrentUser &&
      player.user_type === authUser.user_type &&
      player.remaining_matches > 0 &&
      authUser.remaining_matches > 0;

    return (
      <Card
        key={`${player.id}-${player.user_type}`}
        className={`relative ${
          isCurrentUser ? "border-2 border-green-500 bg-green-50" : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start">
            <Avatar className="h-12 w-12 mr-3">
              <AvatarImage src={player.avatar} alt={player.name} />
              <AvatarFallback>{player.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0">
                  <h3 className="font-semibold truncate max-w-[120px]">
                    {player.name}{" "}
                    {isCurrentUser && (
                      <span className="text-green-600 text-xs font-semibold">
                        (You)
                      </span>
                    )}
                  </h3>
                  {player.is_pro && (
                    <Badge
                      variant="secondary"
                      className="bg-yellow-100 text-yellow-800"
                    >
                      PRO
                    </Badge>
                  )}
                  {player.is_vip && (
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-800"
                    >
                      VIP
                    </Badge>
                  )}
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
              <p className="font-medium">
                {player.kicked_win}/{player.total_kicked}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Goalkeeper Wins</p>
              <p className="font-medium">
                {player.keep_win}/{player.total_keep}
              </p>
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
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Waiting...
                  </span>
                ) : (
                  "Challenge"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">
        Waiting Room
      </h2>

      <Tabs
        defaultValue="basic"
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <TabsList
          className={`grid ${
            user?.user_type === "guest"
              ? "w-full grid-cols-1"
              : "w-full grid-cols-3"
          } mb-4 md:mb-6 gap-2`}
        >
          <TabsTrigger value="basic" className="text-sm md:text-base">
            Basic Players
          </TabsTrigger>
          {user?.user_type !== "guest" && (
            <>
              <TabsTrigger value="pro" className="text-sm md:text-base">
                Pro Players
              </TabsTrigger>
              <TabsTrigger value="vip" className="text-sm md:text-base">
                VIP Players
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="basic">
          <div className="bg-white/80 rounded-xl p-3 md:p-6 min-h-[200px] shadow-inner">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {/* Add Bot Card at the beginning */}
              <BotCard onPlayWithBot={handlePlayWithBot} />

              {isLoading ? (
                Array(8)
                  .fill(0)
                  .map((_, index) => (
                    <Card key={index} className="p-3 md:p-4">
                      <div className="flex items-center space-x-2 md:space-x-3">
                        <Skeleton className="h-10 w-10 md:h-12 md:w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20 md:w-24" />
                          <Skeleton className="h-3 w-14 md:w-16" />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                      </div>
                    </Card>
                  ))
              ) : filteredUsers.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 py-6 md:py-8 text-base md:text-lg font-medium">
                  No data available
                </div>
              ) : (
                filteredUsers.map(renderUserCard)
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pro">
          <div className="bg-white/80 rounded-xl p-3 md:p-6 min-h-[200px] shadow-inner">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {isLoading ? (
                Array(8)
                  .fill(0)
                  .map((_, index) => (
                    <Card key={index} className="p-3 md:p-4">
                      <div className="flex items-center space-x-2 md:space-x-3">
                        <Skeleton className="h-10 w-10 md:h-12 md:w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20 md:w-24" />
                          <Skeleton className="h-3 w-14 md:w-16" />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                      </div>
                    </Card>
                  ))
              ) : filteredUsers.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 py-6 md:py-8 text-base md:text-lg font-medium">
                  No data available
                </div>
              ) : (
                filteredUsers.map(renderUserCard)
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vip">
          <div className="bg-white/80 rounded-xl p-3 md:p-6 min-h-[200px] shadow-inner">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {isLoading ? (
                Array(8)
                  .fill(0)
                  .map((_, index) => (
                    <Card key={index} className="p-3 md:p-4">
                      <div className="flex items-center space-x-2 md:space-x-3">
                        <Skeleton className="h-10 w-10 md:h-12 md:w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20 md:w-24" />
                          <Skeleton className="h-3 w-14 md:w-16" />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                        <Skeleton className="h-4 w-14 md:w-16" />
                      </div>
                    </Card>
                  ))
              ) : filteredUsers.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 py-6 md:py-8 text-base md:text-lg font-medium">
                  No data available
                </div>
              ) : (
                filteredUsers.map(renderUserCard)
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Challenge Invite Modal */}
      {challengeInvite && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 transition-all p-4">
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-xs text-center animate-fade-in border border-gray-200">
            <h3 className="text-base md:text-lg font-bold mb-2 text-black">
              {challengeInvite?.from_name} has challenged you!
            </h3>
            <p className="mb-6 text-gray-700 text-sm md:text-base">
              Do you accept this challenge?
            </p>
            <div className="flex justify-center gap-3 md:gap-4">
              <button
                className="px-4 md:px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-semibold transition shadow text-sm md:text-base"
                onClick={handleAcceptChallenge}
              >
                Accept
              </button>
              <button
                className="px-4 md:px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-semibold transition shadow text-sm md:text-base"
                onClick={handleDeclineChallenge}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Status Toast */}
      {challengeStatus && (
        <div
          className="
          fixed bottom-4 md:bottom-6 right-4 md:right-6 z-50
          flex items-center gap-2 md:gap-3
          px-4 md:px-6 py-3 md:py-4
          rounded-xl md:rounded-2xl
          shadow-2xl
          border border-blue-300
          bg-gradient-to-br from-blue-500/90 to-blue-700/90
          backdrop-blur-md
          animate-fade-in
          text-white
          min-w-[240px] md:min-w-[260px]
          max-w-[calc(100vw-2rem)] md:max-w-xs
          transition-all
        "
        >
          <span className="flex items-center justify-center bg-white/20 rounded-full p-1.5 md:p-2 shadow">
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              className="md:w-7 md:h-7"
            >
              <path
                d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                fill="#fff"
                className="drop-shadow"
              />
            </svg>
          </span>
          <span className="flex-1 font-semibold text-sm md:text-base leading-tight drop-shadow">
            {challengeStatus}
          </span>
          <button
            className="ml-1 md:ml-2 text-white/70 hover:text-white transition"
            onClick={() => setChallengeStatus(null)}
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              fill="none"
              viewBox="0 0 20 20"
              className="md:w-5 md:h-5"
            >
              <path
                d="M6 6l8 8M6 14L14 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      {matchResult &&
        user &&
        (() => {
          const isWinner = matchResult.match_stats.winner.id === user._id;
          const myStats = isWinner
            ? matchResult.match_stats.winner
            : matchResult.match_stats.loser;
          const opponentStats = isWinner
            ? matchResult.match_stats.loser
            : matchResult.match_stats.winner;
          
          const victoryStats = getVictoryStats();
          const showVictoryNFT = isWinner && hasJustReachedMilestone();
          
          return (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 transition-all p-4">
              <div className="bg-white p-0 rounded-xl md:rounded-2xl shadow-2xl w-full max-w-lg text-center animate-fade-in border border-gray-200 overflow-hidden">
                <div
                  className={
                    isWinner
                      ? "h-1.5 md:h-2 bg-gradient-to-r from-green-400 to-blue-500"
                      : "h-1.5 md:h-2 bg-gradient-to-r from-red-400 to-gray-400"
                  }
                />
                <div className="p-6 md:p-10">
                  <h2
                    className={`text-2xl md:text-3xl font-bold mb-4 md:mb-6 ${
                      isWinner ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isWinner ? "Victory" : "Defeat"}
                  </h2>
                  
                  {/* Victory NFT Section */}
                  {showVictoryNFT && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg border-2 border-yellow-300">
                      <div className="flex items-center justify-center mb-3">
                        <Trophy className="w-8 h-8 text-yellow-600 mr-2" />
                        <h3 className="text-xl font-bold text-yellow-800">
                          🎉 Victory NFT Unlocked!
                        </h3>
                      </div>
                      <p className="text-sm text-yellow-700 mb-4">
                        You've reached {victoryStats.totalWins} wins! Mint your exclusive Victory NFT on Avalanche Fuji.
                      </p>
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress to next NFT:</span>
                          <span>{victoryStats.winsToNextMilestone} wins left</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      
                      <Button
                        onClick={() => mintVictoryNFT(selectedChain ?? undefined)}
                        disabled={isMinting}
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold"
                      >
                        {isMinting ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Minting NFT...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Gift className="w-4 h-4 mr-2" />
                            Mint Victory NFT
                          </div>
                        )}
                      </Button>
                    </div>
                  )}
                  
                  <div className="mb-6 md:mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 text-base md:text-lg text-left">
                      <div>
                        <span className="text-gray-500">Your Role:</span>
                        <span className="font-semibold text-black ml-1">
                          {myStats.role.charAt(0).toUpperCase() +
                            myStats.role.slice(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Your Skill:</span>
                        <span className="font-semibold text-black ml-1">
                          {myStats.role === "kicker"
                            ? matchResult.kicker_skill
                            : matchResult.goalkeeper_skill}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Opponent:</span>
                        <span className="font-semibold text-black ml-1">
                          {opponentStats.name} ({opponentStats.role})
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Opponent Skill:</span>
                        <span className="font-semibold text-black ml-1">
                          {opponentStats.role === "kicker"
                            ? matchResult.kicker_skill
                            : matchResult.goalkeeper_skill}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Level:</span>
                        <span className="font-semibold text-black ml-1">
                          {myStats.level}
                          {myStats.level_up && (
                            <span className="ml-2 text-green-600 font-bold">
                              Level Up!
                            </span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          Points this match:
                        </span>
                        <span className="font-semibold text-black ml-1">
                          {isWinner ? "+1" : "0"}
                          {myStats.is_pro && isWinner && (
                            <span className="ml-2 text-yellow-600 font-bold">
                              +1 (Pro)
                            </span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Points:</span>
                        <span className="font-semibold text-black ml-1">
                          {myStats.total_point}
                        </span>
                      </div>
                      {myStats.is_pro && (
                        <div>
                          <span className="text-gray-500">
                            Extra Skill Points:
                          </span>
                          <span className="font-semibold text-black ml-1">
                            {myStats.total_extra_skill}
                          </span>
                        </div>
                      )}
                      {myStats.new_skills && myStats.new_skills.length > 0 && (
                        <div className="col-span-1 sm:col-span-2">
                          <span className="text-gray-500">
                            New Skill Unlocked:
                          </span>
                          <span className="font-semibold text-black ml-1">
                            {myStats.new_skills.join(", ")}
                          </span>
                        </div>
                      )}
                      
                      {/* Victory Progress */}
                      {isWinner && (
                        <div className="col-span-1 sm:col-span-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Victory Progress:</span>
                            <span className="font-semibold text-black">
                              {victoryStats.totalWins} wins
                            </span>
                          </div>
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Next NFT at {victoryStats.nextMilestone} wins</span>
                              <span>{victoryStats.winsToNextMilestone} left</span>
                            </div>
                            <Progress value={victoryStats.progress} className="h-2" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className="mt-4 px-6 md:px-8 py-2.5 md:py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-base md:text-lg transition w-full md:w-auto"
                    onClick={() => setMatchResult(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      <AutoPlayVIP onMatchResult={setMatchResult} />
      {showChainModal && renderChainModal()}
      {showConnectWallet && renderConnectWalletModal()}
    </div>
  );
}
