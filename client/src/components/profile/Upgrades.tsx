import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Crown, 
  Star, 
  Package, 
  Clock, 
  Gamepad2, 
  Sparkles 
} from 'lucide-react';

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
  handleRedeemVIPCode
}: UpgradesProps) {
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
    </div>
  );
} 