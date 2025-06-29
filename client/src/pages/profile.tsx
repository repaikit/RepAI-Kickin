import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { toast } from "sonner";
import { useRouter } from "next/router";
import {
  Pencil,
  Copy,
  ArrowUp,
  Trophy,
  Star,
  Gift,
  Crown,
  Zap,
  Target,
  TrendingUp,
  Award,
  Calendar,
  Clock,
  Sparkles,
  Package,
  Settings as SettingsIcon,
  Gamepad2,
  Shield,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Loader2,
  Shuffle,
  KeyRound,
  CheckCircle2,
  XCircle,
  User2,
  BadgeDollarSign,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Overview from "@/components/profile/Overview";
import Statistics from "@/components/profile/Statistics";
import Upgrades from "@/components/profile/Upgrades";
import Settings from "@/components/profile/Settings";
import WeeklyLoginStats from "@/components/WeeklyLoginStats";
import XConnection from "@/components/TwitterConnection";

import axios from "axios";

import GoalkeeperBot, {
  BotGoalkeeper,
} from "@/components/profile/GoalkeeperBot";

// Add Reward interface for type safety
interface Reward {
  type: "skill" | "remaining_matches";
  value: string | number;
  skill_type?: "kicker" | "goalkeeper";
  skill_name?: string;
  skill_value?: number;
}

// Milestones giống backend
const LEVEL_MILESTONES_BASIC = [
  0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100,
  10500, 12000, 13600, 15300, 17100, 19000, 21000, 23100, 25300, 27600, 30000,
  32500, 35100, 37800, 40600, 43500, 46500, 49600, 52800, 56100, 59500, 63000,
  66600, 70300, 74100, 78000, 82000, 86100, 90300, 94600, 99000, 103500, 108100,
  112800, 117600, 122500, 127500, 132600, 137800, 143100, 148500, 154000,
  159600, 165300, 171100, 177000, 183000, 189100, 195300, 201600, 208000,
  214500, 221100, 227800, 234600, 241500, 248500, 255600, 262800, 270100,
  277500, 285000, 292600, 300300, 308100, 316000, 324000, 332100, 340300,
  348600, 357000, 365500, 374100, 382800, 391600, 400500, 409500, 418600,
  427800, 437100, 446500, 456000, 465600, 475300, 485100, 495000,
];

export default function Profile() {
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuth();
  const { fetchInitialData } = useLeaderboard();
  const [isEditing, setIsEditing] = useState(false);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false);
  const [showMysteryBox, setShowMysteryBox] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [formData, setFormData] = useState({
    name: user?.name || "",
    wallet: user?.wallet || "",
  });
  const [copied, setCopied] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [proInviteCode, setProInviteCode] = useState("");
  const [vipInviteCode, setVipInviteCode] = useState("");
  const [evmWallet, setEvmWallet] = useState(user?.evm_address || "");
  const [solanaWallet, setSolanaWallet] = useState(user?.sol_address || "");
  const [suiWallet, setSuiWallet] = useState(user?.sui_address || "");
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
  const [qrWallet, setQrWallet] = useState<{
    type: string;
    address: string;
  } | null>(null);
  const [showDecodedInfo, setShowDecodedInfo] = useState<{
    [key: string]: boolean;
  }>({});
  const [decodedInfo, setDecodedInfo] = useState<{ [key: string]: string }>({});
  const [isDecoding, setIsDecoding] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [selectedWalletType, setSelectedWalletType] = useState<string | null>(
    null
  );
  const [nftCount, setNftCount] = useState<number | null>(null);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [lastBoxReward, setLastBoxReward] = useState<Reward | null>(null);

  //set up state for the Goalkeeper Bot
  const [bot, setBot] = useState<BotGoalkeeper | null>(null);
  const [botLoading, setBotLoading] = useState(true);
  const [botError, setBotError] = useState<string | null>(null);

  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const HISTORY_PAGE_SIZE = 20;

  useEffect(() => {
    const fetchBot = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setBotError("Bạn chưa đăng nhập.");
        setBotLoading(false);
        return;
      }
      try {
        const res = await axios.get<BotGoalkeeper>(
          API_ENDPOINTS.goalkeeper_bot.me,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setBot(res.data);
      } catch (err: any) {
        const message =
          err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Lỗi không xác định từ server.";
        setBotError(message);
        setBotError(err);
      } finally {
        setBotLoading(false);
      }
    };
    fetchBot();
  }, []);
  // tải bot khi component mount
  const [isLoadingRedeem, setLoadingRedeem] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        wallet: user.wallet || "",
      });
    }
  }, [user]);

  const getAvatarUrl = () => {
    if (user?.avatar) return user.avatar;
    if (user && "picture" in user && user.picture)
      return user.picture as string;
    return undefined;
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "Guest";

  const handleCopyWallet = async (
    address: string | undefined,
    type: string
  ) => {
    if (!address) {
      toast.error("No wallet address available");
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      setCopiedWallet(type);
      toast.success("Wallet address copied!");
      setTimeout(() => setCopiedWallet(null), 1500);
    } catch (err) {
      console.error("Failed to copy wallet address: ", err);
      toast.error("Failed to copy wallet address.");
    }
  };

  const handleUpdateProfile = async (overrideData?: { [key: string]: any }) => {
    if (!user) return;

    setIsSavingProfile(true);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("No access token found");
        return;
      }

      // Always only send name and wallet fields
      let name = formData.name;
      let wallet = formData.wallet;
      if (overrideData) {
        if (typeof overrideData.name === "string") name = overrideData.name;
        if (typeof overrideData.wallet === "string")
          wallet = overrideData.wallet;
      }
      const dataToSend = { name, wallet };

      const response = await fetch(API_ENDPOINTS.users.updateProfile, {
        method: "PATCH",
        headers: {
          ...defaultFetchOptions.headers,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update profile");
      }

      const updatedUserData = await response.json();

      await checkAuth();
      await fetchInitialData();

      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleLevelUp = async () => {
    if (!user) return;
    setIsLevelingUp(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("No access token found");
        return;
      }
      const response = await fetch(API_ENDPOINTS.users.levelUp, {
        method: "POST",
        headers: {
          ...defaultFetchOptions.headers,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to level up");
      }
      const result = await response.json();
      setShowLevelUpAnimation(true);
      setTimeout(() => setShowLevelUpAnimation(false), 3000);
      checkAuth();
      toast.success(`Level up successful! You are now level ${result.level}`);
    } catch (error) {
      console.error("Error leveling up:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to level up"
      );
    } finally {
      setIsLevelingUp(false);
    }
  };

  const handleMysteryBox = async (reward: any) => {
    setLastBoxReward(reward);
    setShowMysteryBox(true);
    setTimeout(() => setShowMysteryBox(false), 2000);
    await checkAuth(); // Refresh user info after opening box
  };

  const handleUpgradeToPro = (inviteCode: string) => {
    toast.info("Pro upgrade feature coming soon! Code: " + inviteCode);
  };

  const handleUpgradeToVIP = (inviteCode: string) => {
    toast.info("VIP upgrade feature coming soon! Code: " + inviteCode);
  };

  const handleRedeemProCode = (inviteCode: string) => {
    toast.info("Redeem Pro code: " + inviteCode);
  };

  const handleRedeemVIPCode = async (inviteCode: string) => {
    setLoadingRedeem(true);
    try {
      const verifyResponse = await fetch(
        API_ENDPOINTS.vip.verifyCode(inviteCode),
        {
          ...defaultFetchOptions,
          headers: {
            ...defaultFetchOptions.headers,
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.detail || "Invalid code");
        toast.error("Invalid code!");
      }

      // If verified, redeem code
      const redeemResponse = await fetch(
        API_ENDPOINTS.vip.redeemCode(inviteCode),
        {
          ...defaultFetchOptions,
          method: "POST",
          headers: {
            ...defaultFetchOptions.headers,
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!redeemResponse.ok) {
        throw new Error("Failed to activate VIP status");
      }

      // Cập nhật trạng thái người dùng
      await checkAuth();
      await fetchInitialData();

      toast.success("VIP status activated successfully!");
      setVipInviteCode(""); // Reset input field
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoadingRedeem(false);
    }
  };

  // Tính milestone tiếp theo cho progress bar
  const currentLevel = user?.level ?? 1;
  const currentPoint = user?.total_point_for_level ?? 0;
  let nextMilestone = currentPoint + 100;
  if (currentLevel > 0 && currentLevel < LEVEL_MILESTONES_BASIC.length) {
    nextMilestone = LEVEL_MILESTONES_BASIC[currentLevel];
  }
  const progress = Math.max(
    0,
    Math.min(100, (currentPoint / nextMilestone) * 100)
  );

  const getUserBadges = () => {
    const badges = [];
    if (user?.is_pro)
      badges.push({
        label: "PRO",
        color: "bg-gradient-to-r from-purple-500 to-pink-500",
        icon: <Crown className="w-3 h-3" />,
      });
    if (user?.is_vip)
      badges.push({
        label: "VIP",
        color: "bg-gradient-to-r from-yellow-400 to-orange-500",
        icon: <Star className="w-3 h-3" />,
      });
    // if (user?.legend_level > 0) badges.push({ label: `Legend ${user.legend_level}`, color: "bg-gradient-to-r from-red-500 to-pink-600", icon: <Trophy className="w-3 h-3" /> });
    return badges;
  };

  const handleDecodeWalletInfo = async (type: string) => {
    setSelectedWalletType(type);
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async () => {
    if (!selectedWalletType || !password) return;

    setIsDecoding(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("No access token found");
        return;
      }

      const response = await fetch(API_ENDPOINTS.users.decodeWalletInfo, {
        method: "POST",
        headers: {
          ...defaultFetchOptions.headers,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          wallet_type: selectedWalletType,
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "Failed to decode wallet information"
        );
      }

      const data = await response.json();
      setDecodedInfo((prev) => ({
        ...prev,
        [selectedWalletType]: data.decoded_info,
      }));
      setShowDecodedInfo((prev) => ({
        ...prev,
        [selectedWalletType]: true,
      }));
      setShowPasswordDialog(false);
      setPassword("");
      toast.success("Wallet information decoded successfully");
    } catch (error) {
      console.error("Error decoding wallet info:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to decode wallet information"
      );
    } finally {
      setIsDecoding(false);
    }
  };

  const fetchNFTs = async (walletAddress: string | undefined) => {
    if (!walletAddress) return;

    setIsLoadingNFTs(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("No access token found");
        return;
      }

      const response = await fetch(API_ENDPOINTS.nft.getNFTs(walletAddress), {
        ...defaultFetchOptions,
        headers: {
          ...defaultFetchOptions.headers,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch NFTs");
      }

      const data = await response.json();

      setNftCount(data.total_nfts);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to fetch NFT information"
      );
    } finally {
      setIsLoadingNFTs(false);
    }
  };

  useEffect(() => {
    if (user?.evm_address) {
      fetchNFTs(user.evm_address);
    } else {
    }
  }, [user?.evm_address]);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(
          `${
            API_ENDPOINTS.users.matchHistory
          }?limit=${HISTORY_PAGE_SIZE}&skip=${
            (historyPage - 1) * HISTORY_PAGE_SIZE
          }`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success) {
          setMatchHistory(data.data.history);
          setHistoryTotal(data.data.total);
        }
      } catch (e) {
        toast.error("Không thể tải lịch sử trận đấu");
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [user, historyPage]);

  return (
    <>
      {showLevelUpAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/20 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4 animate-pulse">🎉</div>
            <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-500 to-pink-600 drop-shadow-lg animate-pulse mb-2">
              LEVEL UP!
            </div>
            <div className="text-2xl text-white font-bold animate-fade-in">
              Level {currentLevel}
            </div>
            <div className="mt-4 flex justify-center space-x-2">
              {[...Array(5)].map((_, i) => (
                <Sparkles
                  key={i}
                  className="w-6 h-6 text-pink-400 animate-spin"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {showMysteryBox && lastBoxReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/20 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">📦</div>
            <div className="text-3xl font-bold text-pink-400 animate-pulse">
              Mystery Box Opened!
            </div>
            <div className="text-lg text-white mt-2">
              {lastBoxReward.type === "skill"
                ? `+ New ${lastBoxReward.skill_type} skill: ${lastBoxReward.skill_name} (${lastBoxReward.skill_value} pts)`
                : `+${lastBoxReward.value} Matches!`}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-pink-900 to-black">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-600 mb-4"></div>
          <p className="text-lg text-pink-100">Loading your profile...</p>
        </div>
      ) : !isAuthenticated || !user ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-pink-900 to-black">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-xl text-pink-100">
            Please log in to view your profile.
          </p>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-pink-900 to-black">
          <Header />

          <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
            {/* Profile Header - Full width */}
            <Card className="bg-gradient-to-r from-pink-600 via-rose-600 to-pink-700 text-white mb-6 overflow-hidden relative border-pink-500/20">
              <div className="absolute inset-0 bg-black/30"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>

              <CardContent className="p-8 relative z-10">
                <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden shadow-xl relative">
                      {getAvatarUrl() ? (
                        <img
                          src={getAvatarUrl()}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white text-3xl font-bold">
                          {displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="h-6 w-6 text-white" />
                      </div>
                    </div>

                    <div className="absolute -bottom-2 -right-2 bg-pink-400 rounded-full p-1">
                      <span className="text-xs font-bold text-black px-1">
                        {currentLevel}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
                    <p className="text-white/80 mb-3">
                      {user?.user_type === "guest"
                        ? "Guest Account"
                        : user?.email || "User Account"}
                    </p>

                    {/* Badges */}
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                      {getUserBadges().map((badge, index) => (
                        <Badge
                          key={index}
                          className={`${badge.color} text-white border-0 shadow-lg`}
                        >
                          {badge.icon}
                          <span className="ml-1">{badge.label}</span>
                        </Badge>
                      ))}
                    </div>

                    {/* Quick Stats */}
                    <div className="flex justify-center md:justify-start space-x-6 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-lg">
                          {user?.total_point ?? 0}
                        </div>
                        <div className="text-white/70">Total Points</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg">
                          {user?.remaining_matches ?? 0}
                        </div>
                        <div className="text-white/70">Matches Left</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg">
                          {Math.round(
                            ((user?.kicked_win ?? 0) /
                              Math.max(user?.total_kicked ?? 1, 1)) *
                              100
                          )}
                          %
                        </div>
                        <div className="text-white/70">Win Rate</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Experience Bar */}
                <div className="mt-6 bg-white/10 rounded-full p-1 backdrop-blur-sm">
                  <div className="flex justify-between text-xs mb-2 px-2">
                    <span>
                      EXP: {currentPoint} / {nextMilestone}
                    </span>
                    <span>Next Level: {currentLevel + 1}</span>
                  </div>
                  <Progress value={progress} className="h-3 bg-white/20" />
                </div>
              </CardContent>
            </Card>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-4 gap-6">
              {/* Left Sidebar - Weekly Stats (Hidden on mobile, shown on large screens) */}
              <div className="hidden lg:block lg:col-span-1">
                <div className="sticky top-6">
                  <WeeklyLoginStats />
                </div>
              </div>

              {/* Mobile Weekly Stats (Shown only on mobile) */}
              <div className="lg:hidden mb-6">
                <WeeklyLoginStats />
              </div>

              {/* Main Content Area */}
              <div className="lg:col-span-3 lg:col-start-2">
                {/* X Connection Card */}
                <div className="mb-6">
                  <XConnection userId={user?._id || ""} />
                </div>

                {/* Tabs Navigation */}
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-5 mb-6 bg-black/20 backdrop-blur-sm border-pink-500/20">
                    <TabsTrigger
                      value="overview"
                      className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white text-pink-100"
                    >
                      <Target className="w-4 h-4" />
                      <span className="hidden sm:inline">Overview</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="stats"
                      className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white text-pink-100"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span className="hidden sm:inline">Statistics</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="upgrades"
                      className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white text-pink-100"
                    >
                      <Crown className="w-4 h-4" />
                      <span className="hidden sm:inline">Upgrades</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="settings"
                      className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white text-pink-100"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Settings</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="history"
                      className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white text-pink-100"
                    >
                      <Shuffle className="w-4 h-4" />
                      <span className="hidden sm:inline">Match History</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab Contents */}
                  <TabsContent value="overview">
                    <Overview
                      user={user}
                      currentPoint={currentPoint}
                      nextMilestone={nextMilestone}
                      isLevelingUp={isLevelingUp}
                      handleLevelUp={handleLevelUp}
                      handleMysteryBox={handleMysteryBox}
                    />
                    <GoalkeeperBot
                      bot={bot}
                      loading={botLoading}
                      error={botError}
                    />
                  </TabsContent>
                  {/* goalkeeper card */}

                  <TabsContent value="stats">
                    <Statistics
                      user={user}
                      isLoadingNFTs={isLoadingNFTs}
                      nftCount={nftCount}
                      copiedWallet={copiedWallet}
                      handleCopyWallet={handleCopyWallet}
                      fetchNFTs={fetchNFTs}
                    />
                  </TabsContent>

                  <TabsContent value="upgrades">
                    <Upgrades
                      user={user}
                      proInviteCode={proInviteCode}
                      vipInviteCode={vipInviteCode}
                      setProInviteCode={setProInviteCode}
                      setVipInviteCode={setVipInviteCode}
                      handleUpgradeToPro={handleUpgradeToPro}
                      handleUpgradeToVIP={handleUpgradeToVIP}
                      handleRedeemProCode={handleRedeemProCode}
                      handleRedeemVIPCode={handleRedeemVIPCode}
                      handleUpdateProfile={handleUpdateProfile}
                    />
                  </TabsContent>

                  <TabsContent value="settings">
                    <Settings
                      user={user}
                      isEditing={isEditing}
                      setIsEditing={setIsEditing}
                      formData={formData}
                      handleInputChange={handleInputChange}
                      handleUpdateProfile={handleUpdateProfile}
                      isSavingProfile={isSavingProfile}
                      copiedWallet={copiedWallet}
                      handleCopyWallet={handleCopyWallet}
                      showDecodedInfo={showDecodedInfo}
                      decodedInfo={decodedInfo}
                      setShowDecodedInfo={setShowDecodedInfo}
                      setDecodedInfo={setDecodedInfo}
                      handleDecodeWalletInfo={handleDecodeWalletInfo}
                      showPasswordDialog={showPasswordDialog}
                      setShowPasswordDialog={setShowPasswordDialog}
                      password={password}
                      setPassword={setPassword}
                      handlePasswordSubmit={handlePasswordSubmit}
                      isDecoding={isDecoding}
                      logout={logout}
                    />
                  </TabsContent>

                  <TabsContent value="history">
                    <div className="bg-white/80 rounded-xl shadow-lg p-4">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Shuffle className="w-5 h-5 text-pink-500" />
                        Match History
                      </h2>
                      {isLoadingHistory ? (
                        <div className="flex items-center gap-2 text-pink-600">
                          <Loader2 className="animate-spin" />
                          Loading...
                        </div>
                      ) : matchHistory.length === 0 ? (
                        <div className="text-gray-500 italic">
                          No matches yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm rounded-xl overflow-hidden">
                            <thead>
                              <tr className="bg-gradient-to-r from-pink-100 to-rose-100 text-center">
                                <th className="px-2 py-2">Time</th>
                                <th className="px-2 py-2">Kicker</th>
                                <th className="px-2 py-2">Goalkeeper</th>
                                <th className="px-2 py-2">Result</th>
                                <th className="px-2 py-2">Skill</th>
                                <th className="px-2 py-2">Random Info</th>
                              </tr>
                            </thead>
                            <tbody>
                              {matchHistory.map((m, idx) => {
                                const isMeKicker = m.kicker_id === user._id;
                                const isMeGoalkeeper =
                                  m.goalkeeper_id === user._id;
                                const isWinner = m.winner_id === user._id;
                                const rowBg =
                                  idx % 2 === 0 ? "bg-white" : "bg-rose-50";
                                return (
                                  <tr
                                    key={idx}
                                    className={`${rowBg} border-b hover:bg-pink-50 transition-all ${
                                      isWinner ? "!bg-green-50" : ""
                                    }`}
                                  >
                                    <td className="px-2 py-1 whitespace-nowrap text-center">
                                      {m.timestamp
                                        ? format(
                                            new Date(m.timestamp),
                                            "dd/MM/yyyy HH:mm"
                                          )
                                        : "-"}
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      {isMeKicker ? (
                                        <span className="font-bold text-pink-600 flex items-center justify-center gap-1">
                                          <User2 className="inline w-4 h-4" />
                                          You
                                        </span>
                                      ) : (
                                        m.kicker_name || m.kicker_id
                                      )}
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      {isMeGoalkeeper ? (
                                        <span className="font-bold text-pink-600 flex items-center justify-center gap-1">
                                          <User2 className="inline w-4 h-4" />
                                          You
                                        </span>
                                      ) : (
                                        m.goalkeeper_name || m.goalkeeper_id
                                      )}
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      {isWinner ? (
                                        <span className="text-green-600 font-bold flex items-center justify-center gap-1">
                                          <CheckCircle2 className="inline w-4 h-4" />
                                          Win
                                        </span>
                                      ) : (
                                        <span className="text-red-600 font-bold flex items-center justify-center gap-1">
                                          <XCircle className="inline w-4 h-4" />
                                          Lose
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      {m.kicker_skill}{" "}
                                      <span className="text-gray-400">/</span>{" "}
                                      {m.goalkeeper_skill}
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      {m.vrf_random_role !== undefined ||
                                      m.vrf_random_kicker_skill !== undefined ||
                                      m.vrf_random_goalkeeper_skill !==
                                        undefined ? (
                                        <div className="flex items-center justify-center">
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-pink-200 to-rose-100 text-pink-900 font-semibold shadow-sm border border-pink-300 cursor-pointer group relative">
                                            <BadgeDollarSign className="w-4 h-4 text-pink-500 mr-1" />
                                            <span>
                                              {m.vrf_random_role !==
                                                undefined &&
                                                `R:${m.vrf_random_role} `}
                                              {m.vrf_random_kicker_skill !==
                                                undefined &&
                                                `K:${m.vrf_random_kicker_skill} `}
                                              {m.vrf_random_goalkeeper_skill !==
                                                undefined &&
                                                `G:${m.vrf_random_goalkeeper_skill}`}
                                            </span>
                                            <Info className="w-3 h-3 text-pink-400 ml-1 group-hover:opacity-100 opacity-60" />
                                            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block bg-white text-xs text-gray-700 rounded shadow-lg px-3 py-2 whitespace-nowrap border border-pink-200">
                                              <div className="mb-1 font-bold text-pink-600">
                                                Random Info
                                              </div>
                                              {m.vrf_random_role !==
                                                undefined && (
                                                <div>
                                                  Role:{" "}
                                                  <b>{m.vrf_random_role}</b>
                                                </div>
                                              )}
                                              {m.vrf_random_kicker_skill !==
                                                undefined && (
                                                <div>
                                                  Kicker:{" "}
                                                  <b>
                                                    {m.vrf_random_kicker_skill}
                                                  </b>
                                                </div>
                                              )}
                                              {m.vrf_random_goalkeeper_skill !==
                                                undefined && (
                                                <div>
                                                  Keeper:{" "}
                                                  <b>
                                                    {
                                                      m.vrf_random_goalkeeper_skill
                                                    }
                                                  </b>
                                                </div>
                                              )}
                                              <div className="mt-1 text-gray-400">
                                                Powered by Chainlink VRF
                                              </div>
                                            </span>
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-gray-300">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {/* Pagination */}
                          <div className="flex justify-end mt-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={historyPage === 1}
                              onClick={() =>
                                setHistoryPage((p) => Math.max(1, p - 1))
                              }
                            >
                              Previous
                            </Button>
                            <span className="text-sm py-1">
                              Page {historyPage} /{" "}
                              {Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                historyPage >=
                                Math.ceil(historyTotal / HISTORY_PAGE_SIZE)
                              }
                              onClick={() => setHistoryPage((p) => p + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      )}
    </>
  );
}
