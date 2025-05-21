import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from "sonner";
import { Pencil, Copy, ArrowUp } from 'lucide-react';
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
  const [formData, setFormData] = useState({
    name: user?.name || '',
    wallet: user?.wallet || '',
  });
  const [copied, setCopied] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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
  
  const handleCopyWallet = async () => {
    if (user?.wallet) {
      try {
        await navigator.clipboard.writeText(user.wallet);
        setCopied(true);
        toast.success('Wallet address copied!');
        setTimeout(() => {
          setCopied(false);
        }, 2000); 
      } catch (err) {
        console.error('Failed to copy wallet address: ', err);
        toast.error('Failed to copy wallet address.');
      }
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
      setTimeout(() => setShowLevelUpAnimation(false), 2000);
      checkAuth();
      toast.success(`Level up successful! You are now level ${result.level}`);
    } catch (error) {
      console.error('Error leveling up:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to level up');
    } finally {
      setIsLevelingUp(false);
    }
  };

  // Tính milestone tiếp theo cho progress bar
  const currentLevel = user?.level ?? 1;
  const currentPoint = user?.total_point_for_level ?? 0;
  let nextMilestone = currentPoint + 100;
  if (currentLevel > 0 && currentLevel < LEVEL_MILESTONES_BASIC.length) {
    nextMilestone = LEVEL_MILESTONES_BASIC[currentLevel];
  }
  const progress = Math.max(0, Math.min(1, currentPoint / nextMilestone));
  return (
    <>
      {/* Animation overlay luôn luôn render, không phụ thuộc vào user/isLoading */}
      {showLevelUpAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-bounce">
            <span className="text-5xl font-extrabold text-yellow-400 drop-shadow-lg animate-pulse">
              🎉 LEVEL UP! 🎉
            </span>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          Loading profile...
        </div>
      ) : !isAuthenticated || !user ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          Please log in to view your profile.
        </div>
      ) : (
        <div className="min-h-screen flex flex-col bg-slate-50">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-10 max-w-xl">
            <div className="bg-white rounded-xl shadow-md p-8 flex flex-col items-center">
              <div className="relative w-24 h-24 rounded-full border-4 border-primary overflow-hidden mb-4 group">
                {getAvatarUrl() ? (
                  <img src={getAvatarUrl()} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center text-white text-3xl font-bold">
                    {displayName[0]?.toUpperCase()}
                  </div>
                )}
                <div 
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-6 w-6 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">{displayName}</h2>
              <p className="text-slate-500 mb-4">
                {user?.user_type === 'guest' ? 'Guest Account' : user?.email || 'User Account'}
              </p>

              <div className="w-full space-y-3 mt-4">
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Type:</span>
                  <span>{user?.user_type === 'guest' ? 'Guest' : 'Registered User'}</span>
                </div>
                <div className="flex justify-between text-slate-700 items-center">
                  <span className="font-medium">Wallet:</span>
                  <div className="flex items-center space-x-2">
                     <span>{user?.wallet || 'N/A'}</span>
                     {user?.wallet && user.wallet !== 'N/A' && (
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={handleCopyWallet} 
                         disabled={copied}
                         className="px-2 py-0 h-auto"
                       >
                         {copied ? (
                           <span className="text-green-600 text-xs">Copied!</span>
                         ) : (
                           <Copy className="h-4 w-4 text-slate-500 hover:text-slate-700" />
                         )}
                       </Button>
                     )}
                  </div>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Points:</span>
                  <span>{user?.total_point ?? 0}</span>
                </div>
                {/* Thanh kinh nghiệm */}
                <div className="my-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span>EXP: {currentPoint} / {nextMilestone}</span>
                    <span>Level {currentLevel}</span>
                  </div>
                  <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Level:</span>
                  <span>{user?.level ?? 1}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Remaining Matches:</span>
                  <span>{user?.remaining_matches ?? 0}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Kicked (Total / Wins):</span>
                  <span>{user?.total_kicked ?? 0} / {user?.kicked_win ?? 0}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Keep (Total / Wins):</span>
                  <span>{user?.total_keep ?? 0} / {user?.keep_win ?? 0}</span>
                </div>
                 <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Legend Level:</span>
                  <span>{user?.legend_level ?? 0}</span>
                </div>
                 <div className="flex justify-between text-slate-700">
                  <span className="font-medium">VIP Level:</span>
                  <span>{user?.vip_level ?? 'NONE'}</span>
                </div>
                 <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Pro Status:</span>
                  <span>{user?.is_pro ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">VIP Status:</span>
                  <span>{user?.is_vip ? 'Yes' : 'No'}</span>
                </div>
                {user?.created_at && (
                  <div className="flex justify-between text-slate-700">
                    <span className="font-medium">Created At:</span>
                    <span>{format(new Date(user.created_at), 'PPP p')}</span>
                  </div>
                )}
                 {user?.last_activity && (
                  <div className="flex justify-between text-slate-700">
                    <span className="font-medium">Last Activity:</span>
                    <span>{format(new Date(user.last_activity), 'PPP p')}</span>
                  </div>
                )}
                {/* Nút Level Up luôn hiển thị */}
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                  <div className="text-center mb-3">
                    <p className={`text-sm mb-1 ${user?.can_level_up ? 'text-blue-600' : 'text-slate-500'}`}>
                      {user?.can_level_up
                        ? "You can level up now!"
                        : "Earn more points to level up!"}
                    </p>
                    <p className="text-lg font-semibold text-blue-600">
                      Current Points: {user?.total_point_for_level ?? 0}
                    </p>
                  </div>
                  <Button
                    onClick={handleLevelUp}
                    disabled={!user?.can_level_up || isLevelingUp}
                    className={`w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white ${!user?.can_level_up ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isLevelingUp ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Leveling Up...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <ArrowUp className="mr-2 h-4 w-4" />
                        Level Up Now!
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                  <DialogDescription>
                    Make changes to your profile here. Click save when you're done.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="wallet" className="text-right">
                      Wallet
                    </Label>
                     <Input
                      id="wallet"
                      name="wallet"
                      value={formData.wallet}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleUpdateProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving...' : 'Save changes'}
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