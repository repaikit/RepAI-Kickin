import React, { useEffect, useState } from "react";
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from "sonner";
import { Pencil, Copy } from 'lucide-react';
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

export default function Profile() {
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        Loading profile...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Redirect or show a message if not authenticated, though AuthContext handles redirect
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        Please log in to view your profile.
      </div>
    );
  }

  return (
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
              <span className="font-medium">Level:</span>
              <span>{user?.level ?? 1}</span>
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
  );
} 