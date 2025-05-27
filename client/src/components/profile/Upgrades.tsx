import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Crown, 
  Star, 
  Package, 
  Clock, 
  Gamepad2, 
  Sparkles,
  Send,
  Wallet,
  Check
} from 'lucide-react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from "sonner";
import { useWallet } from '@/hooks/useWallet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpgradesProps {
  user: any;
  proInviteCode: string;
  vipInviteCode: string;
  setProInviteCode: (code: string) => void;
  setVipInviteCode: (code: string) => void;
  handleUpgradeToPro: (inviteCode: string) => void;
  handleUpgradeToVIP: (inviteCode: string) => void;
  handleRedeemProCode: (inviteCode: string) => void;
  handleRedeemVIPCode: (inviteCode: string) => void;
  handleUpdateProfile: (data: { wallet: string }) => void;
}

export default function Upgrades({
  user,
  proInviteCode,
  vipInviteCode,
  setProInviteCode,
  setVipInviteCode,
  handleUpgradeToPro,
  handleUpgradeToVIP,
  handleRedeemProCode,
  handleRedeemVIPCode,
  handleUpdateProfile
}: UpgradesProps) {
  const [transferAddress, setTransferAddress] = useState('');
  const [transferTokenId, setTransferTokenId] = useState('');

  const {
    connect,
    connectors,
    address,
    isBaseNetwork,
    isPending,
    mintError,
    handleMintNpas,
    handleTransfer,
    walletAddress,
  } = useWallet(user, handleUpdateProfile);

  // Handler for Upgrade to PRO
  const canUpgradeToPro =
    !user?.is_pro &&
    ((user?.level >= 100 || user?.total_point >= 5000) && user?.has_nft_pro_level === true);

  const handleUpgradeToProApi = async () => {
    if (!canUpgradeToPro) return;
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login to upgrade.');
        return;
      }
      const response = await fetch(API_ENDPOINTS.upgradeToPro, {
        method: 'POST',
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Successfully upgraded to PRO!');
      } else {
        toast.error(data.detail || data.message || 'Upgrade failed.');
      }
    } catch (error) {
      toast.error('Upgrade failed.');
    }
  };

  return (
    <div className="space-y-6">
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
              onClick={handleUpgradeToProApi}
              disabled={!canUpgradeToPro}
              className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              {user?.is_pro
                ? 'Already PRO'
                : !user?.has_nft_pro_level
                  ? 'Need NFT Pro Level'
                  : (user?.level >= 100 || user?.total_point >= 5000)
                    ? 'Upgrade to PRO'
                    : 'Need Level 100 or 5000 Points'}
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
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
              <div className="flex items-center space-x-3 mb-2">
                <Gamepad2 className="w-5 h-5 text-purple-600" />
                <span className="font-semibold">AutoPlay Feature</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Enable autoplay for Basic, Pro, and VIP tiers
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                disabled={!user?.is_pro && !user?.is_vip}
              >
                {!user?.is_pro && !user?.is_vip ? 'PRO/VIP Only' : 'Configure'}
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
              {!address ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => connect({ connector: connectors[0] })}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              ) : !isBaseNetwork ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled
                >
                  Switch to Base Network
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center mb-2">
                    <Wallet className="w-4 h-4 mr-2" />
                    <span className="font-mono text-xs">{address}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMintNpas}
                    disabled={isPending}
                    className="w-full"
                  >
                    {isPending ? 'Minting...' : 'Mint NFT'}
                  </Button>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Recipient Address"
                        value={transferAddress}
                        onChange={(e) => setTransferAddress(e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Token ID"
                        value={transferTokenId}
                        onChange={(e) => setTransferTokenId(e.target.value)}
                        className="text-sm w-24"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTransfer(transferAddress)}
                      disabled={!transferAddress || !transferTokenId || isPending}
                      className="w-full"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isPending ? 'Transferring...' : 'Transfer NFT'}
                    </Button>
                  </div>
                </div>
              )}
              {mintError && (
                <p className="text-sm text-red-500 mt-2">{mintError}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 