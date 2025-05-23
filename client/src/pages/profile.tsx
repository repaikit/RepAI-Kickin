import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from "sonner";
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
  Settings,
  Gamepad2,
  QrCode
} from 'lucide-react';
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
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Milestones giống backend
const LEVEL_MILESTONES_BASIC = [
  0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000, 21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500, 46500, 49600, 52800, 56100, 59500, 63000, 66600, 70300, 74100, 78000, 82000, 86100, 90300, 94600, 99000, 103500, 108100, 112800, 117600, 122500, 127500, 132600, 137800, 143100, 148500, 154000, 159600, 165300, 171100, 177000, 183000, 189100, 195300, 201600, 208000, 214500, 221100, 227800, 234600, 241500, 248500, 255600, 262800, 270100, 277500, 285000, 292600, 300300, 308100, 316000, 324000, 332100, 340300, 348600, 357000, 365500, 374100, 382800, 391600, 400500, 409500, 418600, 427800, 437100, 446500, 456000, 465600, 475300, 485100, 495000
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
    name: user?.name || '',
    wallet: user?.wallet || '',
  });
  const [copied, setCopied] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [proInviteCode, setProInviteCode] = useState('');
  const [vipInviteCode, setVipInviteCode] = useState('');
  const [evmWallet, setEvmWallet] = useState(user?.evm_address || '');
  const [solanaWallet, setSolanaWallet] = useState(user?.sol_address || '');
  const [suiWallet, setSuiWallet] = useState(user?.sui_address || '');
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
  const [qrWallet, setQrWallet] = useState<{ type: string, address: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        wallet: user.wallet || '',
      });
    }
  }, [user]);

  const getAvatarUrl = () => {
    if (user?.avatar) return user.avatar;
    if (user && 'picture' in user && user.picture) return user.picture as string;
    return undefined;
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Guest';
  
  const handleCopyWallet = async (address: string, type: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedWallet(type);
      toast.success('Wallet address copied!');
      setTimeout(() => setCopiedWallet(null), 1500);
    } catch (err) {
      console.error('Failed to copy wallet address: ', err);
      toast.error('Failed to copy wallet address.');
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    setIsSavingProfile(true);

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('No access token found');
        return;
      }

      const dataToSend: { [key: string]: any } = { ...formData };

      const response = await fetch(API_ENDPOINTS.users.updateProfile, {
        method: 'PATCH',
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update profile');
      }

      const updatedUserData = await response.json();

      await checkAuth(); 
      await fetchInitialData();
      
      toast.success('Profile updated successfully!');
      console.log('Profile updated:', updatedUserData);
      setIsEditing(false);

    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleLevelUp = async () => {
    if (!user) return;
    setIsLevelingUp(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('No access token found');
        return;
      }
      const response = await fetch(API_ENDPOINTS.users.levelUp, {
        method: 'POST',
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to level up');
      }
      const result = await response.json();
      setShowLevelUpAnimation(true);
      setTimeout(() => setShowLevelUpAnimation(false), 3000);
      checkAuth();
      toast.success(`Level up successful! You are now level ${result.level}`);
    } catch (error) {
      console.error('Error leveling up:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to level up');
    } finally {
      setIsLevelingUp(false);
    }
  };

  const handleMysteryBox = () => {
    setShowMysteryBox(true);
    setTimeout(() => setShowMysteryBox(false), 2000);
    toast.success("Mystery box opened! Check your inventory.");
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

  const handleRedeemVIPCode = (inviteCode: string) => {
    toast.info("Redeem VIP code: " + inviteCode);
  };

  // Tính milestone tiếp theo cho progress bar
  const currentLevel = user?.level ?? 1;
  const currentPoint = user?.total_point_for_level ?? 0;
  let nextMilestone = currentPoint + 100;
  if (currentLevel > 0 && currentLevel < LEVEL_MILESTONES_BASIC.length) {
    nextMilestone = LEVEL_MILESTONES_BASIC[currentLevel];
  }
  const progress = Math.max(0, Math.min(100, (currentPoint / nextMilestone) * 100));

  const getUserBadges = () => {
    const badges = [];
    if (user?.is_pro) badges.push({ label: "PRO", color: "bg-gradient-to-r from-purple-500 to-pink-500", icon: <Crown className="w-3 h-3" /> });
    if (user?.is_vip) badges.push({ label: "VIP", color: "bg-gradient-to-r from-yellow-400 to-orange-500", icon: <Star className="w-3 h-3" /> });
    // if (user?.legend_level > 0) badges.push({ label: `Legend ${user.legend_level}`, color: "bg-gradient-to-r from-red-500 to-pink-600", icon: <Trophy className="w-3 h-3" /> });
    return badges;
  };

  return (
    <>
      {/* Enhanced Level Up Animation */}
      {showLevelUpAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/20 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4 animate-pulse">🎉</div>
            <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 drop-shadow-lg animate-pulse mb-2">
              LEVEL UP!
            </div>
            <div className="text-2xl text-white font-bold animate-fade-in">
              Level {currentLevel}
            </div>
            <div className="mt-4 flex justify-center space-x-2">
              {[...Array(5)].map((_, i) => (
                <Sparkles key={i} className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mystery Box Animation */}
      {showMysteryBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/20 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">📦</div>
            <div className="text-3xl font-bold text-yellow-400 animate-pulse">
              Mystery Box Opened!
            </div>
            <div className="text-lg text-white mt-2">
              +50 Points Earned!
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mb-4"></div>
          <p className="text-lg text-gray-600">Loading your profile...</p>
        </div>
      ) : !isAuthenticated || !user ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-xl text-gray-600">Please log in to view your profile.</p>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
            {/* Profile Header Card */}
            <Card className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 text-white mb-6 overflow-hidden relative">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
              
              <CardContent className="p-8 relative z-10">
                <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden shadow-xl relative">
                      {getAvatarUrl() ? (
                        <img src={getAvatarUrl()} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-3xl font-bold">
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
                    <div className="absolute -bottom-2 -right-2 bg-yellow-400 rounded-full p-1">
                      <span className="text-xs font-bold text-black px-1">{currentLevel}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
                    <p className="text-white/80 mb-3">
                      {user?.user_type === 'guest' ? 'Guest Account' : user?.email || 'User Account'}
                    </p>
                    
                    {/* Badges */}
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                      {getUserBadges().map((badge, index) => (
                        <Badge key={index} className={`${badge.color} text-white border-0 shadow-lg`}>
                          {badge.icon}
                          <span className="ml-1">{badge.label}</span>
                        </Badge>
                      ))}
                    </div>

                    {/* Quick Stats */}
                    <div className="flex justify-center md:justify-start space-x-6 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-lg">{user?.total_point ?? 0}</div>
                        <div className="text-white/70">Total Points</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg">{user?.remaining_matches ?? 0}</div>
                        <div className="text-white/70">Matches Left</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg">{Math.round(((user?.kicked_win ?? 0) / Math.max(user?.total_kicked ?? 1, 1)) * 100)}%</div>
                        <div className="text-white/70">Win Rate</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Experience Bar */}
                <div className="mt-6 bg-white/10 rounded-full p-1 backdrop-blur-sm">
                  <div className="flex justify-between text-xs mb-2 px-2">
                    <span>EXP: {currentPoint} / {nextMilestone}</span>
                    <span>Next Level: {currentLevel + 1}</span>
                  </div>
                  <Progress value={progress} className="h-3 bg-white/20" />
                </div>
              </CardContent>
            </Card>

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-white/80 backdrop-blur-sm">
                <TabsTrigger value="overview" className="flex items-center space-x-2">
                  <Target className="w-4 h-4" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value="stats" className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Statistics</span>
                </TabsTrigger>
                <TabsTrigger value="upgrades" className="flex items-center space-x-2">
                  <Crown className="w-4 h-4" />
                  <span>Upgrades</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Level Up Card */}
                  <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <ArrowUp className="w-5 h-5" />
                        <span>Level Progress</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center mb-4">
                        <p className={`text-sm mb-2 ${user?.can_level_up ? 'text-yellow-300' : 'text-white/70'}`}>
                          {user?.can_level_up
                            ? "🎉 Ready to level up!"
                            : "Keep earning points to level up!"}
                        </p>
                        <div className="text-2xl font-bold mb-4">
                          {currentPoint} / {nextMilestone} EXP
                        </div>
                      </div>
                      <Button
                        onClick={handleLevelUp}
                        disabled={!user?.can_level_up || isLevelingUp}
                        className={`w-full bg-white/20 hover:bg-white/30 text-white border-white/30 ${!user?.can_level_up ? 'opacity-50 cursor-not-allowed' : 'animate-pulse'}`}
                      >
                        {isLevelingUp ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Leveling Up...
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <Zap className="mr-2 h-4 w-4" />
                            Level Up Now!
                          </div>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Mystery Box Card */}
                  <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Package className="w-5 h-5" />
                        <span>Mystery Box</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center mb-4">
                        <div className="text-4xl mb-2">📦</div>
                        <p className="text-sm text-white/80 mb-4">
                          Open mystery boxes to earn bonus rewards!
                        </p>
                      </div>
                      <Button
                        onClick={handleMysteryBox}
                        className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
                      >
                        <Gift className="mr-2 h-4 w-4" />
                        Open Mystery Box
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Info Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className="p-4 text-center">
                      <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                      <div className="font-bold text-lg">{user?.legend_level ?? 0}</div>
                      <div className="text-sm text-gray-600">Legend Level</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className="p-4 text-center">
                      <Star className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                      <div className="font-bold text-lg">{user?.vip_level ?? 'NONE'}</div>
                      <div className="text-sm text-gray-600">VIP Level</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className="p-4 text-center">
                      <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                      <div className="font-bold text-lg">{user?.remaining_matches ?? 0}</div>
                      <div className="text-sm text-gray-600">Matches Left</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className="p-4 text-center">
                      <Award className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <div className="font-bold text-lg">{user?.total_point ?? 0}</div>
                      <div className="text-sm text-gray-600">Total Points</div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Statistics Tab */}
              <TabsContent value="stats" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Game Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Kicked:</span>
                        <span className="font-semibold">{user?.total_kicked ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Kicked Wins:</span>
                        <span className="font-semibold text-green-600">{user?.kicked_win ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Keep:</span>
                        <span className="font-semibold">{user?.total_keep ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Keep Wins:</span>
                        <span className="font-semibold text-green-600">{user?.keep_win ?? 0}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">Overall Win Rate:</span>
                        <span className="font-bold text-blue-600">
                          {Math.round(((user?.kicked_win ?? 0) + (user?.keep_win ?? 0)) / Math.max((user?.total_kicked ?? 0) + (user?.total_keep ?? 0), 1) * 100)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Account Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Wallet:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-sm">{user?.wallet ? `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}` : 'N/A'}</span>
                          {user?.wallet && user.wallet !== 'N/A' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setIsEditing(true)}
                              className="px-2 py-0 h-auto"
                            >
                              {copied ? (
                                <span className="text-green-600 text-xs">Copied!</span>
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      {user?.created_at && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Member Since:</span>
                          <span className="font-semibold">{format(new Date(user.created_at), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      {user?.last_activity && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Last Active:</span>
                          <span className="font-semibold">{format(new Date(user.last_activity), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Upgrades Tab */}
              <TabsContent value="upgrades" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Crown className="w-5 h-5" />
                        <span>Upgrade to PRO</span>
                      </CardTitle>
                      <CardDescription className="text-white/80">
                        Unlock premium features and benefits
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          <span className="text-sm">Unlimited matches per day</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          <span className="text-sm">5000 bonus points</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          <span className="text-sm">NFT Pro Level benefits</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Invite Pro Code"
                          value={proInviteCode}
                          onChange={e => setProInviteCode(e.target.value)}
                          className="bg-white/20 text-white border-white/30 placeholder-white/60"
                          disabled={user?.is_pro}
                        />
                        <Button
                          onClick={() => handleRedeemProCode(proInviteCode)}
                          disabled={user?.is_pro}
                          className="bg-white/30 hover:bg-white/40 text-white border-white/30"
                        >
                          Redeem
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleUpgradeToPro(proInviteCode)}
                        disabled={user?.is_pro}
                        className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
                      >
                        {user?.is_pro ? 'Already PRO' : 'Upgrade to PRO'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Star className="w-5 h-5" />
                        <span>Upgrade to VIP</span>
                      </CardTitle>
                      <CardDescription className="text-white/80">
                        Experience the ultimate gaming luxury
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          <span className="text-sm">Exclusive VIP features</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          <span className="text-sm">NFT VIP Pass benefits</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          <span className="text-sm">Priority support & rewards</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Invite VIP Code"
                          value={vipInviteCode}
                          onChange={e => setVipInviteCode(e.target.value)}
                          className="bg-white/20 text-white border-white/30 placeholder-white/60"
                          disabled={user?.is_vip}
                        />
                        <Button
                          onClick={() => handleRedeemVIPCode(vipInviteCode)}
                          disabled={user?.is_vip}
                          className="bg-white/30 hover:bg-white/40 text-white border-white/30"
                        >
                          Redeem
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleUpgradeToVIP(vipInviteCode)}
                        disabled={user?.is_vip}
                        className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
                      >
                        {user?.is_vip ? 'Already VIP' : 'Upgrade to VIP'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Upgrade Options */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Special Features</CardTitle>
                    <CardDescription>Additional upgrades and features available</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                        <div className="flex items-center space-x-3 mb-2">
                          <Package className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold">Mystery Box Level Up</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Unlock special mystery boxes with exclusive rewards
                        </p>
                        <Button size="sm" variant="outline" className="w-full">
                          Coming Soon
                        </Button>
                      </div>

                      <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-100">
                        <div className="flex items-center space-x-3 mb-2">
                          <Clock className="w-5 h-5 text-green-600" />
                          <span className="font-semibold">Mystery Box 5 Hours</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Get mystery boxes every 5 hours automatically
                        </p>
                        <Button size="sm" variant="outline" className="w-full">
                          Coming Soon
                        </Button>
                      </div>

                      <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                        <div className="flex items-center space-x-3 mb-2">
                          <Gamepad2 className="w-5 h-5 text-purple-600" />
                          <span className="font-semibold">AutoPlay Feature</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Enable autoplay for Basic, Pro, and VIP tiers
                        </p>
                        <Button size="sm" variant="outline" className="w-full">
                          Configure
                        </Button>
                      </div>

                      <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-100">
                        <div className="flex items-center space-x-3 mb-2">
                          <Sparkles className="w-5 h-5 text-yellow-600" />
                          <span className="font-semibold">NFT Mint Pass</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Mint exclusive NFTs with your achievements
                        </p>
                        <Button size="sm" variant="outline" className="w-full">
                          Coming Soon
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>Manage your account preferences and information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="display-name" className="text-right font-medium">
                          Display Name
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
                          <Input
                            id="display-name"
                            value={user?.name || ''}
                            readOnly
                            className="bg-gray-50"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right font-medium">
                          Email
                        </Label>
                        <Input
                          id="email"
                          value={user?.email || ''}
                          readOnly
                          className="col-span-3 bg-gray-50"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="wallet-address" className="text-right font-medium">
                          Wallet Address
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
                          <Input
                            id="wallet-address"
                            value={user?.wallet || ''}
                            readOnly
                            className="bg-gray-50 font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right font-medium">
                          Account Type
                        </Label>
                        <div className="col-span-3">
                          <Badge variant={user?.user_type === 'guest' ? 'secondary' : 'default'}>
                            {user?.user_type === 'guest' ? 'Guest Account' : 'Registered User'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Kick'in Wallet</h3>
                      <div className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="evm-wallet" className="text-right font-medium">
                            EVM Wallet
                          </Label>
                          <div className="col-span-3 flex items-center gap-2">
                            <Input
                              id="evm-wallet"
                              value={user?.evm_address || ''}
                              readOnly
                              className="bg-gray-50 font-mono text-sm"
                            />
                            {user?.evm_address && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleCopyWallet(user.evm_address!, 'evm')}
                                  className="p-2"
                                >
                                  {copiedWallet === 'evm' ? (
                                    <span className="text-green-600 text-xs">✓</span>
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="solana-wallet" className="text-right font-medium">
                            Solana Wallet
                          </Label>
                          <div className="col-span-3 flex items-center gap-2">
                            <Input
                              id="solana-wallet"
                              value={user?.sol_address || ''}
                              readOnly
                              className="bg-gray-50 font-mono text-sm"
                            />
                            {user?.sol_address && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleCopyWallet(user.sol_address!, 'sol')}
                                  className="p-2"
                                >
                                  {copiedWallet === 'sol' ? (
                                    <span className="text-green-600 text-xs">✓</span>
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="sui-wallet" className="text-right font-medium">
                            SUI Wallet
                          </Label>
                          <div className="col-span-3 flex items-center gap-2">
                            <Input
                              id="sui-wallet"
                              value={user?.sui_address || ''}
                              readOnly
                              className="bg-gray-50 font-mono text-sm"
                            />
                            {user?.sui_address && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleCopyWallet(user.sui_address!, 'sui')}
                                  className="p-2"
                                >
                                  {copiedWallet === 'sui' ? (
                                    <span className="text-green-600 text-xs">✓</span>
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Game Preferences</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="font-medium">Auto-play Notifications</Label>
                            <p className="text-sm text-gray-600">Get notified when auto-play completes</p>
                          </div>
                          <Button variant="outline" size="sm">
                            Configure
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="font-medium">Mystery Box Alerts</Label>
                            <p className="text-sm text-gray-600">Receive alerts for available mystery boxes</p>
                          </div>
                          <Button variant="outline" size="sm">
                            Enable
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="font-medium">Level Up Celebrations</Label>
                            <p className="text-sm text-gray-600">Show animations when leveling up</p>
                          </div>
                          <Button variant="outline" size="sm">
                            On
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-semibold">Account Actions</h3>
                          <p className="text-sm text-gray-600">Manage your account</p>
                        </div>
                        <div className="space-x-2">
                          <Button variant="outline" onClick={() => setIsEditing(true)}>
                            Edit Profile
                          </Button>
                          <Button variant="destructive" onClick={logout}>
                            Sign Out
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Edit Profile Dialog */}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <Pencil className="w-5 h-5" />
                    <span>Edit Profile</span>
                  </DialogTitle>
                  <DialogDescription>
                    Update your profile information. Changes will be saved to your account.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Display Name
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter your display name"
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="wallet" className="text-sm font-medium">
                      Wallet Address
                    </Label>
                    <Input
                      id="wallet"
                      name="wallet"
                      value={formData.wallet}
                      onChange={handleInputChange}
                      placeholder="Enter your wallet address"
                      className="w-full font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Your wallet address for receiving rewards and NFTs
                    </p>
                  </div>
                </div>
                <DialogFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateProfile} 
                    disabled={isSavingProfile}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                  >
                    {isSavingProfile ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </main>
          <Footer />
        </div>
      )}
    </>
  );
}